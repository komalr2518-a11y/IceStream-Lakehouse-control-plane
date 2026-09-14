'use client';

import { memo, useMemo } from 'react';
import {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type PipelineData = {
  title: string;
  caption: string;
  state: 'healthy' | 'watching' | 'blocked';
};
type PipelineNode = Node<PipelineData, 'pipeline'>;

const PipelineCard = memo(function PipelineCard({ data }: NodeProps<PipelineNode>) {
  return (
    <div className={`flow-node flow-${data.state}`}>
      <Handle type="target" position={Position.Left} />
      <span className="flow-dot" />
      <div><strong>{data.title}</strong><small>{data.caption}</small></div>
      <span className="flow-state">{data.state}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

const nodeTypes = { pipeline: PipelineCard };

export const PipelineCanvas = memo(function PipelineCanvas({ circuitOpen, running }: { circuitOpen: boolean; running: boolean }) {
  const nodes = useMemo<PipelineNode[]>(() => {
    const blocked = circuitOpen ? 'blocked' : 'healthy';
    return [
      { id: 'ingest', type: 'pipeline', position: { x: 16, y: 74 }, data: { title: 'Event ingress', caption: 'Kafka adapter', state: 'healthy' } },
      { id: 'process', type: 'pipeline', position: { x: 250, y: 74 }, data: { title: 'Stream processor', caption: 'Stateful validation', state: running ? 'healthy' : 'watching' } },
      { id: 'quality', type: 'pipeline', position: { x: 484, y: 74 }, data: { title: 'Quality gate', caption: '6 governed rules', state: circuitOpen ? 'blocked' : 'watching' } },
      { id: 'serve', type: 'pipeline', position: { x: 718, y: 18 }, data: { title: 'Serving table', caption: 'Analytics-ready', state: blocked } },
      { id: 'dlq', type: 'pipeline', position: { x: 718, y: 132 }, data: { title: 'Quarantine', caption: 'Dead-letter queue', state: circuitOpen ? 'watching' : 'healthy' } },
    ];
  }, [circuitOpen, running]);
  const edges = useMemo<Edge[]>(() => {
    const activeColor = circuitOpen ? '#e4593f' : '#118671';
    return [
      { id: 'e1', source: 'ingest', target: 'process', animated: running, style: { stroke: '#5f8882', strokeWidth: 2 } },
      { id: 'e2', source: 'process', target: 'quality', animated: running, style: { stroke: '#5f8882', strokeWidth: 2 } },
      { id: 'e3', source: 'quality', target: 'serve', animated: running && !circuitOpen, style: { stroke: activeColor, strokeWidth: 2.5 } },
      { id: 'e4', source: 'quality', target: 'dlq', animated: circuitOpen, style: { stroke: circuitOpen ? '#e4593f' : '#a7b8b5', strokeWidth: 2.5 } },
    ];
  }, [circuitOpen, running]);

  return (
    <div className="flow-canvas" aria-label="Checkout telemetry lineage graph">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.65} maxZoom={1.2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }}>
        <Background color="#d7e1df" gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
});
