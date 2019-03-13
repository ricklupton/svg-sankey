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
  .option('-k, --scale <k>', 'scale (px/value)', Number)
  .option('--font-size <s>', 'font-size (px/value)', Number)
  .option('--node-values <fmt>', 'd3 format string to show node values', parseFormat)
  .action(function(filename) {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) throw err; // we'll not consider error handling for now
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

function nodeTitle(d) {
  return d.title !== undefined ? (d.title.label !== undefined ? d.title.label : d.title) : d.id;
}

function linkTypeTitle(d) {
  return d.title !== undefined ? d.title : d.type;
}

const color = scaleOrdinal(schemeCategory20);
function linkColor(d) {
  return (d.color !== undefined
          ? d.color
          : (d.style !== undefined && d.style.color !== undefined
             ? d.style.color
             : color(d.type)));
}

const fmt = format('.3s');

// const linkTitle = sankeyLinkTitle(nodeTitle, linkTypeTitle, fmt);
function linkTitle(d) {
  const parts = []
  const sourceTitle = nodeTitle(d.source)
  const targetTitle = nodeTitle(d.target)
  const matTitle = linkTypeTitle(d)

  parts.push(`${sourceTitle} → ${targetTitle}`)
  if (matTitle) parts.push(matTitle)
  parts.push(fmt(d.data.value))
  return parts.join('\n')
}

function drawDiagram(data) {
  const width = program.size ? program.size[0] : 800,
        height = program.size ? program.size[1] : 600;

  const color = scaleOrdinal(schemeCategory20);

  const margins = program.margins || { top: 0, bottom: 0, left: 0, right: 0 };

  const ordering = (data.metadata && data.metadata.layers)
        ? data.metadata.layers
        : (data.order && data.order.length ? data.order : null)

  const layout = sankey()
        .linkValue(function (d) { return d.data.value; })
        .size([width - margins.left - margins.right, height - margins.top - margins.bottom])
        .ordering(ordering)
        .rankSets(data.rankSets);

  if (program.position) {
    layout.nodePosition(d => [d[program.position.xattr], d[program.position.yattr]]);
  }

  if (program.scale) {
    layout.scale(program.scale);
  }

  const diagram = sankeyDiagram()
        .nodeTitle(nodeTitle)
        .nodeValue(program.nodeValues ? (d => program.nodeValues(d.value)) : (d => ''))
        .linkTitle(linkTitle)
        .linkColor(linkColor)
        .linkMinWidth(d => 0.1)
        .margins(margins)
        .groups(data.groups || []);

  const document = jsdom.jsdom();
  const el = select(document).select('body').append('svg');

  el
    .datum(layout(data))
    .call(diagram);

  // put default styles inline
  el
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .style('font-size', program.fontSize || null)
    .style('font-family',
           'Helvetica, Arial, sans-serif');

  el.selectAll('.link')
    .style('opacity', 0.8);

  el.selectAll('line')
    .style('stroke', d => d.style === 'process' ? '#888' : '#000')
    .style('stroke-width', d => d.style === 'process' ? '4px' : '1px');

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

  // add title
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
