import { architecture } from './content';
import { step } from './motion';

type Dir = 'r' | 'l' | 'u' | 'd';
type NodeKey = keyof typeof architecture.nodes;

interface NodeSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Baseline of the title's first line, relative to the node's top edge. */
  title: number;
  /** The title as shown; omit to use the node's own name from the copy. */
  titleLines?: string[];
  /** Baselines of each note line, relative to the node's top edge. */
  notes: { y: number; text: string; sub?: boolean }[];
}

interface EdgeSpec {
  key: string;
  /** The path of the line, ending where the arrowhead's base starts. */
  d: string;
  tip: [x: number, y: number, dir: Dir];
  label: { x: number; y: number; lines: string[]; anchor?: 'start' | 'middle' | 'end' };
  amber?: boolean;
}

interface Layout {
  viewBox: string;
  nodeSize: { title: number; note: number };
  labelSize: number;
  nodes: Record<NodeKey, NodeSpec>;
  edges: EdgeSpec[];
  boundary: { d: string; x: number; y: number; lines: string[] };
}

const { nodes: copy, edges: edge } = architecture;

/** An arrowhead whose tip sits at (x, y) and points along `dir`. */
function head(x: number, y: number, dir: Dir): string {
  const long = 12;
  const half = 6;
  switch (dir) {
    case 'r':
      return `M${x} ${y}L${x - long} ${y - half}L${x - long} ${y + half}Z`;
    case 'l':
      return `M${x} ${y}L${x + long} ${y - half}L${x + long} ${y + half}Z`;
    case 'u':
      return `M${x} ${y}L${x - half} ${y + long}L${x + half} ${y + long}Z`;
    case 'd':
      return `M${x} ${y}L${x - half} ${y - long}L${x + half} ${y - long}Z`;
  }
}

/** Left to right: the vendor on the left, the independent client on the right, the chain above both. */
const wide: Layout = {
  viewBox: '0 0 1240 400',
  nodeSize: { title: 22, note: 16 },
  labelSize: 16,
  nodes: {
    members: {
      x: 0,
      y: 260,
      w: 170,
      h: 100,
      title: 44,
      notes: [{ y: 72, text: copy.members.note }],
    },
    vendor: {
      x: 330,
      y: 260,
      w: 230,
      h: 100,
      title: 44,
      notes: [{ y: 72, text: copy.vendor.note }],
    },
    registry: {
      x: 400,
      y: 14,
      w: 360,
      h: 140,
      title: 52,
      notes: [
        { y: 88, text: copy.registry.note },
        { y: 116, text: copy.registry.sub, sub: true },
      ],
    },
    bundle: {
      x: 640,
      y: 260,
      w: 200,
      h: 100,
      title: 44,
      notes: [{ y: 72, text: copy.bundle.note }],
    },
    restore: {
      x: 960,
      y: 260,
      w: 280,
      h: 100,
      title: 38,
      notes: [
        { y: 64, text: 'six checks ·' },
        { y: 84, text: 'never calls the vendor' },
      ],
    },
  },
  edges: [
    {
      key: 'change',
      d: 'M170 310H318',
      tip: [330, 310, 'r'],
      label: { x: 244, y: 294, lines: [edge.change], anchor: 'middle' },
    },
    {
      key: 'append',
      d: 'M445 260V166',
      tip: [445, 154, 'u'],
      label: { x: 433, y: 214, lines: [edge.append], anchor: 'end' },
    },
    {
      key: 'export',
      d: 'M560 310H628',
      tip: [640, 310, 'r'],
      label: { x: 600, y: 294, lines: [edge.exportBundle], anchor: 'middle' },
    },
    {
      key: 'pass',
      d: 'M840 310H948',
      tip: [960, 310, 'r'],
      label: { x: 0, y: 0, lines: [] },
    },
    {
      key: 'reads',
      d: 'M1000 260V135Q1000 115 980 115H772',
      tip: [760, 115, 'l'],
      label: { x: 880, y: 100, lines: [edge.reads], anchor: 'middle' },
    },
    {
      key: 'rotate',
      d: 'M1150 260V70Q1150 50 1130 50H772',
      tip: [760, 50, 'l'],
      label: { x: 945, y: 36, lines: [edge.rotate], anchor: 'middle' },
      amber: true,
    },
  ],
  boundary: { d: 'M740 176V392', x: 740, y: 208, lines: [architecture.boundary] },
};

/** Top to bottom for narrow screens: the chain of hands on the right, the registry beside it. */
const tall: Layout = {
  viewBox: '0 0 360 630',
  nodeSize: { title: 17, note: 13 },
  labelSize: 12.5,
  nodes: {
    members: {
      x: 176,
      y: 0,
      w: 180,
      h: 80,
      title: 34,
      notes: [{ y: 58, text: copy.members.note }],
    },
    vendor: {
      x: 176,
      y: 140,
      w: 180,
      h: 80,
      title: 34,
      notes: [{ y: 58, text: copy.vendor.note }],
    },
    registry: {
      x: 0,
      y: 110,
      w: 96,
      h: 510,
      title: 40,
      titleLines: ['Portaldot', 'registry'],
      notes: [
        { y: 150, text: 'owner ·' },
        { y: 168, text: 'epoch ·' },
        { y: 186, text: 'count ·' },
        { y: 204, text: 'head' },
        { y: 240, text: 'events', sub: true },
        { y: 256, text: 'carry the', sub: true },
        { y: 272, text: 'digests', sub: true },
      ],
    },
    bundle: {
      x: 176,
      y: 320,
      w: 180,
      h: 80,
      title: 34,
      notes: [{ y: 58, text: copy.bundle.note }],
    },
    restore: {
      x: 176,
      y: 480,
      w: 180,
      h: 124,
      title: 34,
      notes: [
        { y: 62, text: 'six checks ·' },
        { y: 82, text: 'never calls the vendor' },
      ],
    },
  },
  edges: [
    {
      key: 'change',
      d: 'M266 80V128',
      tip: [266, 140, 'd'],
      label: { x: 254, y: 116, lines: [edge.change], anchor: 'end' },
    },
    {
      key: 'append',
      d: 'M176 180H108',
      tip: [96, 180, 'l'],
      label: { x: 136, y: 168, lines: [edge.append], anchor: 'middle' },
    },
    {
      key: 'export',
      d: 'M266 220V308',
      tip: [266, 320, 'd'],
      label: { x: 254, y: 275, lines: [edge.exportBundle], anchor: 'end' },
    },
    {
      key: 'pass',
      d: 'M266 400V468',
      tip: [266, 480, 'd'],
      label: { x: 0, y: 0, lines: [] },
    },
    {
      key: 'reads',
      d: 'M176 530H108',
      tip: [96, 530, 'l'],
      label: { x: 136, y: 506, lines: ['reads and', 'checks'], anchor: 'middle' },
    },
    {
      key: 'rotate',
      d: 'M176 592H108',
      tip: [96, 592, 'l'],
      label: { x: 136, y: 551, lines: ['rotateEpoch,', 'then new', 'writes'], anchor: 'middle' },
      amber: true,
    },
  ],
  boundary: { d: 'M104 360H356', x: 138, y: 337, lines: ['no code', 'path'] },
};

/** Order of the draw: the arrows follow the story, the amber takeover is last. */
const ORDER = ['change', 'append', 'export', 'pass', 'reads', 'rotate'] as const;
const NODE_ORDER: NodeKey[] = ['members', 'vendor', 'registry', 'bundle', 'restore'];

function Node({
  spec,
  name,
  order,
  layout,
}: {
  spec: NodeSpec;
  name: NodeKey;
  order: number;
  layout: Layout;
}) {
  const cx = spec.x + spec.w / 2;
  const isRegistry = name === 'registry';
  return (
    <g className="dg-node" style={step(order)}>
      <rect
        x={spec.x}
        y={spec.y}
        width={spec.w}
        height={spec.h}
        rx={14}
        className={isRegistry ? 'dg-box dg-box-lit' : 'dg-box'}
      />
      <text
        x={cx}
        y={spec.y + spec.title}
        textAnchor="middle"
        className="dg-title"
        fontSize={layout.nodeSize.title}
      >
        {(spec.titleLines ?? [copy[name].title]).map((text, line) => (
          <tspan key={text} x={cx} dy={line === 0 ? 0 : layout.nodeSize.title * 1.15}>
            {text}
          </tspan>
        ))}
      </text>
      {spec.notes.map((note) => (
        <text
          key={note.text}
          x={cx}
          y={spec.y + note.y}
          textAnchor="middle"
          className={note.sub ? 'dg-note dg-sub' : 'dg-note'}
          fontSize={layout.nodeSize.note}
        >
          {note.text}
        </text>
      ))}
    </g>
  );
}

function Graph({ layout, className }: { layout: Layout; className: string }) {
  return (
    <svg
      viewBox={layout.viewBox}
      className={`d-dg ${className}`}
      role="img"
      aria-label="How the parts connect. Members send an encrypted change to Vendor A. Vendor A appends batches to the Portaldot registry and exports a bundle and key. Packout Restore reads and checks the registry and never calls the vendor. After the exit it calls rotateEpoch, then writes anew. There is no code path between Vendor A and Packout Restore."
    >
      {layout.edges.map((item) => {
        const rank = ORDER.indexOf(item.key as (typeof ORDER)[number]);
        const [tx, ty, dir] = item.tip;
        const order = NODE_ORDER.length + rank + 1;
        return (
          <g
            key={item.key}
            className={item.amber ? 'dg-edge dg-amber' : 'dg-edge'}
            style={step(order)}
          >
            <path d={item.d} pathLength={1} className="dg-line" />
            <path d={head(tx, ty, dir)} className="dg-head" />
            {item.label.lines.map((text, line) => (
              <text
                key={text}
                x={item.label.x}
                y={item.label.y + line * 14}
                textAnchor={item.label.anchor ?? 'middle'}
                className="dg-label"
                fontSize={layout.labelSize}
              >
                {text}
              </text>
            ))}
          </g>
        );
      })}
      <g className="dg-boundary" style={step(NODE_ORDER.length + ORDER.length)}>
        <path d={layout.boundary.d} className="dg-dash" />
        {layout.boundary.lines.map((text, line) => (
          <text
            key={text}
            x={layout.boundary.x}
            y={layout.boundary.y + line * 14}
            textAnchor="middle"
            className="dg-label dg-no"
            fontSize={layout.labelSize}
          >
            {text}
          </text>
        ))}
      </g>
      {NODE_ORDER.map((name, index) => (
        <Node key={name} name={name} spec={layout.nodes[name]} order={index} layout={layout} />
      ))}
    </svg>
  );
}

/** The one diagram: wide on desktop, stacked on phones. Lines draw in order; the amber one last. */
export function ArchitectureDiagram() {
  return (
    <div className="d-dg-wrap">
      <Graph layout={wide} className="d-dg-wide" />
      <Graph layout={tall} className="d-dg-tall" />
    </div>
  );
}
