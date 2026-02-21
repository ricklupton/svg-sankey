import program from 'commander';
import fs from 'fs';
import jsdom from 'jsdom';
import xmlserializer from 'xmlserializer';

import {select} from 'd3-selection';
import {scaleOrdinal, schemeCategory20} from 'd3-scale';
import {format} from 'd3-format';

import {sankey, sankeyDiagram, sankeyLinkTitle} from 'd3-sankey-diagram';

// diagram

program
  .arguments('<file>')
  .option('-s, --size <w>,<h>', 'width and height', parseSize)
  .option('-m, --margins <n>[,...]', '1, 2 or 4 margin values', parseMargins)
  .option('-p, --position <xattr>,<yattr>', 'node attributes to set positions (manual layout)', parseAttrs)
  .option('--position-attr <attr>', 'node attribute holding [x, y] position array (widget-style manual layout)')
  .option('-k, --scale <k>', 'scale (px/value)', Number)
  .option('--font-size <s>', 'font-size (px/value)', Number)
  .option('--node-values <fmt>', 'd3 format string to show node values', parseFormat)
  .option('--align-link-types', 'align links of the same type at source and target ports')
  .option('--link-label-format <fmt>', 'd3 format string to show labels on links', parseFormat)
  .option('--link-label-min-width <w>', 'minimum link thickness (px) to show a label', Number)
  .option('--format <fmt>', 'input JSON format: "widget" or "sankey-v2" (auto-detected if not specified)')
  .action(function(filename) {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) throw err;
      const parsedData = JSON.parse(data);
      const svg = drawDiagram(parsedData);
      process.stdout.write(svg);
    });
  })
  .parse(process.argv);


function parseFormat(val) {
  return format(val)
}

function parseMargins(val) {
  val = val.split(',').map(x => x.trim()).map(Number);
  if (val.length === 1) {
    return {top: val[0], right: val[0], bottom: val[0], left: val[0]};
  } else if (val.length === 2) {
    return {top: val[0], right: val[1], bottom: val[0], left: val[1]};
  } else if (val.length === 4) {
    return {top: val[0], right: val[1], bottom: val[2], left: val[3]};
  } else {
    throw new Error('Expected 1, 2 or 4 numbers');
  }
}


function parseSize(val) {
  val = val.split(',').map(x => x.trim()).map(Number);
  if (val.length === 1) {
    return [val[0], val[0]];
  } else if (val.length === 2) {
    return val;
  } else {
    throw new Error('Expected 1 or 2');
  }
}


function parseAttrs(val) {
  val = val.split(',').map(x => x.trim());
  if (val.length === 2) {
    return {xattr: val[0], yattr: val[1]};
  } else {
    throw new Error('Expected 2 attribute names');
  }
}


function alignLinkTypes(layout, align) {
  return layout
    .sourceId(function(d) { return { id: typeof d.source === "object" ? d.source.id : d.source,
                                     port: align ? d.type : null }; })
    .targetId(function(d) { return { id: typeof d.target === "object" ? d.target.id : d.target,
                                     port: align ? d.type : null }; });
}

/**
 * Detect the JSON format of the input data.
 *
 * - "sankey-v2": floweaver's regular format (has data.format === "sankey-v2")
 * - "widget": floweaver's widget format / ipysankeywidget format (no format field)
 *
 * The --format CLI option overrides auto-detection.
 */
function detectFormat(data) {
  if (program.format) {
    return program.format;
  }
  if (data.format === 'sankey-v2') {
    return 'sankey-v2';
  }
  // Default to widget format for any JSON without a "format" field
  return 'widget';
}

/**
 * Get the node's style/type string for CSS styling purposes.
 *
 * - Widget format: the type is in node.type (e.g. "default", "process")
 * - Sankey-v2 format: the type is nested in node.style.type
 * - Legacy: may be directly as node.style string
 */
function getNodeType(d) {
  if (d.type !== undefined && typeof d.type === 'string') {
    return d.type;  // widget format
  }
  if (d.style !== undefined) {
    if (typeof d.style === 'string') {
      return d.style;  // direct string (legacy)
    }
    if (typeof d.style === 'object' && d.style.type !== undefined) {
      return d.style.type;  // sankey-v2 format
    }
  }
  return 'default';
}

/**
 * Normalise a node object so that d3-sankey-diagram gets the fields it needs
 * at the top level, regardless of whether the source is widget or sankey-v2 format.
 *
 * d3-sankey-diagram reads:
 *   - d.direction  (for backwards/right-to-left nodes)
 *   - d.style      (string, for node type styling — we also set d.type)
 *   - d.hidden     (for hidden nodes)
 *   - d.fromElsewhere / d.toElsewhere (0.9.x, for elsewhere links)
 */
function normaliseNode(d, fmt) {
  if (fmt === 'sankey-v2' && d.style && typeof d.style === 'object') {
    // Extract style sub-object fields to top level
    const styleObj = d.style;
    return Object.assign({}, d, {
      direction: styleObj.direction || d.direction,
      hidden: styleObj.hidden !== undefined ? styleObj.hidden : d.hidden,
      type: styleObj.type || 'default',
      // Set style as a string so d3-sankey-diagram's internal style checks work
      style: styleObj.type || 'default',
    });
  }
  // Widget format: direction/hidden/type are already at top level.
  // Ensure style is set as a string for d3-sankey-diagram compatibility.
  if (d.type !== undefined && d.style === undefined) {
    return Object.assign({}, d, { style: d.type });
  }
  return d;
}

function nodeTitle(d) {
  // Hidden nodes show no title
  if (d.hidden) return '';
  const title = d.title;
  if (title === undefined) return d.id;
  // Support {label: "..."} title objects as well as plain strings
  if (title.label !== undefined) return title.label;
  return title;
}

function linkTypeTitle(d) {
  return d.title !== undefined ? d.title : d.type;
}

const color = scaleOrdinal(schemeCategory20);
function linkColor(d) {
  // Widget format: d.color at top level
  // Sankey-v2 format: d.style.color
  // Fall back to type-based color
  if (d.color !== undefined && d.color !== null) {
    return d.color;
  }
  if (d.style !== undefined && typeof d.style === 'object' && d.style.color !== undefined) {
    return d.style.color;
  }
  return color(d.type);
}

const fmt = format('.3s');

function linkTitle(d) {
  const parts = [];
  const sourceTitle = nodeTitle(d.source);
  const targetTitle = nodeTitle(d.target);
  const matTitle = linkTypeTitle(d);

  parts.push(`${sourceTitle} → ${targetTitle}`);
  if (matTitle) parts.push(matTitle);
  parts.push(fmt(d.value));
  return parts.join('\n');
}

function drawDiagram(data) {
  const width = program.size ? program.size[0] : 800,
        height = program.size ? program.size[1] : 600;

  const color = scaleOrdinal(schemeCategory20);

  const margins = program.margins || { top: 0, bottom: 0, left: 0, right: 0 };

  const fmt = detectFormat(data);

  // Support ordering from both formats:
  // - sankey-v2: data.metadata.layers
  // - widget: data.order
  const ordering = (data.metadata && data.metadata.layers)
        ? data.metadata.layers
        : (data.order && data.order.length ? data.order : null);

  // Normalise nodes for d3-sankey-diagram compatibility
  const nodes = (data.nodes || []).map(d => normaliseNode(d, fmt));

  // Determine link value accessor:
  // - Widget format links have `value` at top level (= visual width / link_width)
  // - Sankey-v2 format links have `link_width` but svg-sankey historically used data.value
  // Use `d.value` if present (widget format), else fall back to `d.data.value`
  function linkValue(d) {
    if (d.value !== undefined) return d.value;
    if (d.data !== undefined && d.data.value !== undefined) return d.data.value;
    return 0;
  }

  const layout = sankey()
        .linkValue(linkValue)
        .size([width - margins.left - margins.right, height - margins.top - margins.bottom])
        .ordering(ordering)
        .rankSets(data.rankSets || data.rank_sets);

  // Manual layout via --position-attr (widget style: attribute holds [x, y])
  if (program.positionAttr) {
    layout.nodePosition(d => d[program.positionAttr]);
    if (!layout.scale()) layout.scale(1);
  } else if (program.position) {
    // Legacy --position xattr,yattr
    layout.nodePosition(d => [d[program.position.xattr], d[program.position.yattr]]);
  }

  if (program.scale) {
    layout.scale(program.scale);
  }

  alignLinkTypes(layout, program.alignLinkTypes || false);

  // Link label function (shown inline on links, new in d3-sankey-diagram 0.9.x)
  const linkLabelMinWidth = program.linkLabelMinWidth !== undefined ? program.linkLabelMinWidth : 5;
  const linkLabelFn = program.linkLabelFormat
    ? (d => d.dy > linkLabelMinWidth ? program.linkLabelFormat(d.value) : null)
    : (d => null);

  const diagram = sankeyDiagram()
        .nodeTitle(nodeTitle)
        .nodeValue(program.nodeValues ? (d => program.nodeValues(d.value)) : (d => ''))
        .linkTitle(linkTitle)
        .linkColor(linkColor)
        .linkMinWidth(d => 0.1)
        .linkLabel(linkLabelFn)
        .margins(margins)
        .groups(data.groups || []);

  const document = jsdom.jsdom();
  const el = select(document).select('body').append('svg');

  el
    .datum(layout({nodes: nodes, links: data.links || []}))
    .call(diagram);

  // put default styles inline
  el
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .style('font-size', program.fontSize || null)
    .style('font-family',
           '"Helvetica Neue", Helvetica, Arial, sans-serif');

  el.selectAll('.link')
    .style('opacity', 0.8);

  // Experimental: per-link markers (bracket-style indicators)
  const scale = layout.scale();
  el.selectAll('.link')
    .selectAll('.link-marker')
    .data(d => d.marker ? [d] : [])
    .enter()
    .append('path')
    .attr('class', 'link-marker')
    .style('stroke', 'black')
    .style('fill', 'none')
    .style('opacity', 0.8)
    .attr('transform', d => `translate(${d.points[0].x + 10}, ${d.points[0].y})`)
    .attr('d', d => `M-4,-${d.marker / 2 * scale} l8,0 m-4,0 l0,${d.marker * scale} m-4,0 l8,0`);

  el.selectAll('line')
    .style('stroke', d => getNodeType(d) === 'process' ? '#888' : '#000')
    .style('stroke-width', d => getNodeType(d) === 'process' ? '4px' : '1px');

  el.selectAll('rect')
    .style('fill', 'none');

  el.selectAll('.group').select('rect')
    .style('fill', '#eee')
    .style('stroke', '#bbb')
    .style('stroke-width', '0.5');

  el.selectAll('.group').select('text')
    .style('fill', '#999');

  // add background
  el.insert('rect', ':first-child')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'white');

  // add title (sankey-v2 format only)
  if (data.metadata && data.metadata.title !== undefined) {
    el.append('text')
      .attr('x', width - 30)
      .attr('y', 30)
      .style('font-size', '200%')
      .style('text-anchor', 'end')
      .text(data.metadata.title);
  }

  // create a file blob of our SVG.
  const svg = serialize(el.node());
  return svg;
}

const serialize = function(node){
  return '<?xml version="1.0" standalone="no"?>'
    + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
    xmlserializer.serializeToString(node);
};
