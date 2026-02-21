# svg-sankey

Create SVG Sankey diagrams from the command line. Uses [d3-sankey-diagram](https://github.com/ricklupton/d3-sankey-diagram).

## Installation

svg-sankey requires [`node` and `npm`](https://nodejs.org).

```shell
npm install -g svg-sankey
```

## Usage

```shell
svg-sankey --size 800,600 --margins 10,150 sankey_data.json > sankey.svg
```

### Input format

Two JSON input formats are supported, auto-detected from the file contents:

**Widget format** (default, produced by [floweaver](https://github.com/ricklupton/floweaver)'s `to_json(format="widget")`):

```json
{
  "nodes": [
    {"id": "a", "title": "A", "direction": "r", "hidden": false, "type": "default",
     "fromElsewhere": [], "toElsewhere": []}
  ],
  "links": [
    {"source": "a", "target": "b", "type": "flow", "value": 5.0,
     "data": {"value": 5.0}, "color": "#aabbcc", "opacity": 1.0}
  ],
  "order": [[["a"]], [["b"]]],
  "groups": []
}
```

**Sankey-v2 format** (produced by floweaver's `to_json()` with no format argument):

```json
{
  "format": "sankey-v2",
  "metadata": {"title": "My diagram", "authors": [], "layers": [[["a"]], [["b"]]]},
  "nodes": [
    {"id": "a", "title": "A", "style": {"direction": "r", "hidden": false, "type": "default"}}
  ],
  "links": [
    {"source": "a", "target": "b", "type": "flow", "data": {"value": 5.0},
     "style": {"color": "#aabbcc", "opacity": 1.0}}
  ],
  "groups": []
}
```

### Options

```
-s, --size <w>,<h>              Width and height in pixels (default: 800,600)
-m, --margins <n>[,...]         1, 2, or 4 margin values
-k, --scale <k>                 Scale factor (px per unit value)
    --font-size <s>             Font size in pixels
    --node-values <fmt>         d3 format string to show node values
    --align-link-types          Align links of the same type at node ports
    --link-label-format <fmt>   d3 format string for inline link labels (e.g. ".2s")
    --link-label-min-width <w>  Minimum link thickness (px) to show a label (default: 5)
-p, --position <xattr>,<yattr>  Node attributes for manual x/y positions
    --position-attr <attr>      Node attribute holding [x, y] position array
    --format <fmt>              Force input format: "widget" or "sankey-v2"
```

### Floweaver integration

To export a floweaver diagram to SVG from the command line:

```python
# In your Jupyter notebook / Python script
sankey_data.to_json("diagram.json", format="widget")
```

```shell
svg-sankey --size 1200,600 --margins 25,130,10,130 diagram.json > diagram.svg
```

Note: the default margins in `to_widget()` are `{top: 25, bottom: 10, left: 130, right: 130}`.
