'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface Link {
  source: string;
  target: string;
}

const defaultNodes: Node[] = [
  { id: 'godshew', label: 'GodShew', x: 200, y: 200 },
  { id: '2kinds', label: 'Two Kinds of Liberty', x: 120, y: 120 },
  { id: 'eternallife', label: 'Eternal Life', x: 280, y: 120 },
  { id: 'bornagain', label: 'Born Again', x: 280, y: 280 },
  { id: 'law', label: 'The Law', x: 120, y: 280 },
  { id: 'twainshew', label: 'Twain Shew', x: 350, y: 200 },
  { id: 'rightlydividing', label: 'Rightly Dividing', x: 50, y: 200 },
  { id: 'sion', label: 'Sion', x: 200, y: 60 }
];

const defaultLinks: Link[] = [
  { source: 'godshew', target: '2kinds' },
  { source: 'godshew', target: 'eternallife' },
  { source: 'godshew', target: 'bornagain' },
  { source: 'godshew', target: 'law' },
  { source: 'godshew', target: 'twainshew' },
  { source: 'godshew', target: 'rightlydividing' },
  { source: 'godshew', target: 'sion' },
  { source: '2kinds', target: 'law' },
  { source: 'eternallife', target: 'bornagain' },
  { source: 'twainshew', target: 'eternallife' },
  { source: 'rightlydividing', target: '2kinds' },
  { source: 'sion', target: 'eternallife' }
];

export default function MindOfChristGraph() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>(defaultNodes);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Simple physics simulation effect for dynamic graph feel
  useEffect(() => {
    let animationId: number;
    
    const tick = () => {
      setNodes((prevNodes) => {
        // Apply tiny attractive force toward center and repulsion between nodes
        const kCenter = 0.01;
        const kRepel = 200;
        
        return prevNodes.map((n, i) => {
          let fx = 0;
          let fy = 0;
          
          // Pull to center
          fx += (200 - n.x) * kCenter;
          fy += (200 - n.y) * kCenter;
          
          // Repel from others
          prevNodes.forEach((other, j) => {
            if (i === j) return;
            const dx = n.x - other.x;
            const dy = n.y - other.y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);
            if (dist < 100) {
              fx += (dx / dist) * (kRepel / distSq);
              fy += (dy / dist) * (kRepel / distSq);
            }
          });

          // Cap max speed
          const vx = Math.max(-1, Math.min(1, fx));
          const vy = Math.max(-1, Math.min(1, fy));
          
          return {
            ...n,
            x: Math.max(20, Math.min(380, n.x + vx)),
            y: Math.max(20, Math.min(380, n.y + vy))
          };
        });
      });
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleNodeClick = (id: string) => {
    router.push(`/pages/${id}`);
  };

  return (
    <div className="graph-container">
      <svg width="100%" height="100%" viewBox="0 0 400 400">
        {/* Render Links */}
        {defaultLinks.map((link, i) => {
          const sourceNode = nodes.find((n) => n.id === link.source);
          const targetNode = nodes.find((n) => n.id === link.target);
          if (!sourceNode || !targetNode) return null;
          
          const isHighlighted = hoveredNode === link.source || hoveredNode === link.target;
          
          return (
            <line
              key={i}
              className="graph-link"
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              style={{
                stroke: isHighlighted ? 'var(--accent)' : '#ccc',
                strokeWidth: isHighlighted ? 2.5 : 1.5,
                transition: 'stroke 0.2s ease, stroke-width 0.2s ease'
              }}
            />
          );
        })}

        {/* Render Nodes */}
        {nodes.map((node) => {
          const isHighlighted = hoveredNode === node.id;
          const isConnected = hoveredNode
            ? defaultLinks.some(
                (l) =>
                  (l.source === node.id && l.target === hoveredNode) ||
                  (l.target === node.id && l.source === hoveredNode)
              )
            : false;

          return (
            <g
              key={node.id}
              className="graph-node"
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node.id)}
            >
              <circle
                r={isHighlighted ? 12 : 8}
                fill={isHighlighted ? 'var(--accent)' : isConnected ? 'var(--primary)' : '#555'}
                style={{ transition: 'r 0.2s ease, fill 0.2s ease' }}
              />
              <text
                y="-15"
                textAnchor="middle"
                style={{
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  fill: isHighlighted ? 'var(--accent)' : '#222',
                  fontWeight: isHighlighted || isConnected ? 'bold' : 'normal',
                  pointerEvents: 'none'
                }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
