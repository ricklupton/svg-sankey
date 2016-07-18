import program from 'commander';
import fs from 'fs';
import d3 from 'd3';
import jsdom from 'jsdom';
import xmlserializer from 'xmlserializer';

import sankeyDiagram from 'd3-sankey-diagram';

// diagram

program
  .arguments('<file>')
  .option('-s, --size <w>,<h>', 'width and height', parseSize)
  .option('-m, --margins <n>[,...]', '1, 2 or 4 margin values', parseMargins)
  .action(function(filename) {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) throw err; // we'll not consider error handling for now
      const parsedData = JSON.parse(data);
      const svg = drawDiagram(parsedData);
      process.stdout.write(svg);
    });
  })
  .parse(process.argv);


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


function drawDiagram(data) {
  const width = program.size ? program.size[0] : 800,
        height = program.size ? program.size[1] : 600;

  const color = d3.scale.category20();

  const diagram = sankeyDiagram()
          .duration(null)
          .width(width)
          .height(height)
          .nodeTitle(function(d) { return d.data.title !== undefined ? d.data.title : d.id; })
          .linkTypeTitle(function(d) { return d.data.title; })
          .linkColor(function(d) { return d.data.color !== undefined ? d.data.color : color(d.data.type); });

  if (program.margins) {
    diagram.margins(program.margins);
  }

  const document = jsdom.jsdom();
  const el = d3.select(document).select('body').append('div');

  el
    .datum(data)
    .call(diagram);

  // put default styles inline
  el.select('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .style('font-family',
           '"Helvetica Neue", Helvetica, Arial, sans-serif');

  el.selectAll('.link')
    .style('opacity', 0.8);

  el.selectAll('line')
    .style('stroke', d => style(d) === 'process' ? '#888' : '#000')
    .style('stroke-width', d => style(d) === 'process' ? '4px' : '1px');

  el.selectAll('rect')
    .style('fill', 'none');

  el.selectAll('.group').select('rect')
    .style('fill', '#eee')
    .style('stroke', '#bbb')
    .style('stroke-width', '0.5');

  el.selectAll('.group').select('text')
    .style('fill', '#999');

  // add background
  el.select('svg').insert('rect', ':first-child')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'white');

  // create a file blob of our SVG.
  const svg = serialize(el.select('svg').node());
  return svg;
}

function style(d) {
  return (d.data || {}).style;
}

const serialize = function(node){
  return '<?xml version="1.0" standalone="no"?>'
    + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
    xmlserializer.serializeToString(node);
};
