# svg-sankey

Create SVG Sankey diagrams from the command line. Uses [d3-sankey-diagram](https://github.com/ricklupton/d3-sankey-diagram).

## Installation

svg-sankey requires `node` and `npm`.

```shell
npm install -g svg-sankey
```

## Usage

```shell
svg-sankey --size 800,600 --margins 10,150 sankey_data.json > sankey.svg
```

The input data format is JSON with exactly the same content as used by [d3-sankey-diagram](https://github.com/ricklupton/d3-sankey-diagram). See the [documentation](https://github.com/ricklupton/d3-sankey-diagram/wiki#diagram) and [examples](https://ricklupton.github.io/d3-sankey-diagram/).
