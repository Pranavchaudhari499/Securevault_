import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showStats, setShowStats] = useState(true);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const posRef = useRef({});
  const draggingNodeRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Force-directed layout parameters
  const simulationRef = useRef({
    repulsion: 1000,
    attraction: 0.1,
    damping: 0.9,
    iterations: 0
  });

  const load = useCallback(async () => {
    try {
      const d = await bankAPI.getNetworkGraph();
      if (d) setGraphData(d);
    } catch (e) { 
      console.error('Network graph:', e);
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Initialize positions with a better layout
  useEffect(() => {
    if (!graphData.nodes.length) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size to match container
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize positions if not set using a simple force-directed layout
    if (Object.keys(posRef.current).length === 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.35;
      
      // Group nodes by type for better initial layout
      const userNodes = graphData.nodes.filter(n => n.type === 'user');
      const recipientNodes = graphData.nodes.filter(n => n.type === 'recipient');
      const ipNodes = graphData.nodes.filter(n => n.type === 'ip');
      
      // Position users in an inner circle
      userNodes.forEach((n, i) => {
        const angle = (i / userNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { 
          x: centerX + radius * 0.6 * Math.cos(angle), 
          y: centerY + radius * 0.6 * Math.sin(angle) 
        };
      });
      
      // Position recipients in a middle ring
      recipientNodes.forEach((n, i) => {
        const angle = (i / recipientNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { 
          x: centerX + radius * 0.8 * Math.cos(angle), 
          y: centerY + radius * 0.8 * Math.sin(angle) 
        };
      });
      
      // Position IPs in an outer ring
      ipNodes.forEach((n, i) => {
        const angle = (i / ipNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { 
          x: centerX + radius * Math.cos(angle), 
          y: centerY + radius * Math.sin(angle) 
        };
      });
    }

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [graphData]);

  // Apply force-directed layout for better visualization
  useEffect(() => {
    if (!graphData.nodes.length) return;
    
    const simulateForces = () => {
      let positions = { ...posRef.current };
      const nodes = graphData.nodes;
      const edges = graphData.edges;
      const repulsion = simulationRef.current.repulsion;
      const attraction = simulationRef.current.attraction;
      
      // Calculate forces
      nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos || draggingNodeRef.current === node.id) return;
        
        let fx = 0, fy = 0;
        
        // Repulsion between nodes
        nodes.forEach(other => {
          if (node.id === other.id) return;
          const otherPos = positions[other.id];
          if (!otherPos) return;
          
          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });
        
        // Attraction along edges
        edges.filter(e => e.from === node.id || e.to === node.id).forEach(edge => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const otherPos = positions[otherId];
          if (!otherPos) return;
          
          const dx = otherPos.x - pos.x;
          const dy = otherPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist * attraction;
          
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });
        
        // Apply forces with damping
        pos.x += fx * simulationRef.current.damping;
        pos.y += fy * simulationRef.current.damping;
        
        // Keep within bounds
        const padding = 50;
        pos.x = Math.max(padding, Math.min(canvasRef.current.width - padding, pos.x));
        pos.y = Math.max(padding, Math.min(canvasRef.current.height - padding, pos.y));
      });
      
      posRef.current = positions;
      
      // Stop after stable configuration
      simulationRef.current.iterations++;
      if (simulationRef.current.iterations < 100) {
        animationFrameRef.current = requestAnimationFrame(simulateForces);
      } else {
        simulationRef.current.iterations = 0;
      }
    };
    
    // Start simulation
    animationFrameRef.current = requestAnimationFrame(simulateForces);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [graphData]);

  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    
    ctx.clearRect(0, 0, W, H);
    
    // Apply zoom and pan
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);
    
    // Dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);
    
    // Draw edges
    graphData.edges.forEach(e => {
      const from = posRef.current[e.from];
      const to = posRef.current[e.to];
      if (!from || !to) return;
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      
      // Highlight edges of hovered/selected nodes
      const isHighlighted = hovered && (e.from === hovered || e.to === hovered);
      const isSelectedEdge = selected && (e.from === selected || e.to === selected);
      
      ctx.strokeStyle = e.type === 'ip_link' 
        ? `rgba(245,158,11,${isHighlighted || isSelectedEdge ? '0.8' : '0.3'})`
        : `rgba(79,110,247,${isHighlighted || isSelectedEdge ? '0.6' : '0.25'})`;
      ctx.lineWidth = isHighlighted || isSelectedEdge ? 2 : 1;
      ctx.stroke();
      
      // Edge label with better positioning
      if (e.label) {
        ctx.save();
        ctx.fillStyle = `rgba(148,163,184,${isHighlighted || isSelectedEdge ? '0.9' : '0.6'})`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        // Add background for better readability
        ctx.fillStyle = 'rgba(10,10,15,0.8)';
        ctx.fillRect(midX - 20, midY - 7, 40, 14);
        
        ctx.fillStyle = `rgba(148,163,184,${isHighlighted || isSelectedEdge ? '0.9' : '0.6'})`;
        ctx.fillText(e.label, midX, midY);
        ctx.restore();
      }
    });
    
    // Draw nodes
    graphData.nodes.forEach(n => {
      const pos = posRef.current[n.id];
      if (!pos) return;
      
      const isSelected = selected === n.id;
      const isHovered = hovered === n.id;
      const isDragging = draggingNodeRef.current === n.id;
      
      const r = n.type === 'user' ? 14 : n.type === 'recipient' ? 11 : 8;
      
      // Node color based on risk and type
      let color;
      if (n.risk >= 60) {
        color = '#f43f5e';
      } else {
        switch(n.type) {
          case 'ip': color = '#f59e0b'; break;
          case 'recipient': color = '#a78bfa'; break;
          default: color = '#4f6ef7';
        }
      }
      
      // Glow effect for high-risk nodes
      if (n.risk >= 60) {
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
      }
      
      // Draw node
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      
      // Gradient fill
      const gradient = ctx.createRadialGradient(pos.x - 2, pos.y - 2, 2, pos.x, pos.y, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, `${color}aa`);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 1.5;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
      
      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Node label
      ctx.font = `${isSelected ? 'bold ' : ''}10px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = n.risk >= 60 ? '#f87171' : '#94a3b8';
      
      let label = n.label || n.id;
      if (label.length > 16) {
        label = label.slice(0, 14) + '…';
      }
      
      // Label background for better readability
      ctx.fillStyle = 'rgba(10,10,15,0.7)';
      const metrics = ctx.measureText(label);
      const labelWidth = metrics.width + 10;
      ctx.fillRect(pos.x - labelWidth/2, pos.y + r + 5, labelWidth, 16);
      
      ctx.fillStyle = isHovered ? color : '#94a3b8';
      ctx.fillText(label, pos.x, pos.y + r + 16);
    });
    
    ctx.restore();
    
    // Draw zoom level indicator
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(transform.scale * 100)}%`, 10, 20);
    ctx.restore();
    
  }, [graphData, selected, hovered, transform]);

  // Animation loop
  useEffect(() => {
    let animationId;
    
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [draw]);

  // Event handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top - transform.offsetY) / transform.scale;
    
    // Check for node dragging
    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist < 20) {
        draggingNodeRef.current = n.id;
        setIsDragging(true);
        setDragStart({ x: mx - pos.x, y: my - pos.y });
        return;
      }
    }
    
    // Canvas panning
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.offsetX, y: e.clientY - transform.offsetY });
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top - transform.offsetY) / transform.scale;
    
    // Hover detection
    let hoveredNode = null;
    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist < 20) {
        hoveredNode = n.id;
        break;
      }
    }
    setHovered(hoveredNode);
    
    // Dragging
    if (isDragging) {
      if (draggingNodeRef.current) {
        // Node dragging
        const nodePos = posRef.current[draggingNodeRef.current];
        if (nodePos) {
          nodePos.x = mx - dragStart.x;
          nodePos.y = my - dragStart.y;
        }
      } else {
        // Canvas panning
        setTransform({
          ...transform,
          offsetX: e.clientX - dragStart.x,
          offsetY: e.clientY - dragStart.y
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    draggingNodeRef.current = null;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale * delta));
    
    // Zoom towards mouse position
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const scaleChange = newScale / transform.scale;
    const newOffsetX = mouseX - (mouseX - transform.offsetX) * scaleChange;
    const newOffsetY = mouseY - (mouseY - transform.offsetY) * scaleChange;
    
    setTransform({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });
  };

  const handleClick = (e) => {
    if (isDragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top - transform.offsetY) / transform.scale;
    
    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist < 20) {
        setSelected(selected === n.id ? null : n.id);
        return;
      }
    }
    setSelected(null);
  };

  const resetView = () => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const selectedNode = selected ? graphData.nodes.find(n => n.id === selected) : null;

  return (
    <Layout>
      <div style={{ maxWidth: '1100px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Fraud Network Graph</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Visual map of suspicious transactions, shared devices and IPs</p>
          </div>
          <button 
            onClick={resetView}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              color: 'var(--text-2)'
            }}
          >
            Reset View
          </button>
        </div>
        
        <div className="grid-2" style={{ gap: '16px' }}>
          <div 
            ref={containerRef}
            className="card" 
            style={{ padding: '4px', position: 'relative' }}
          >
            {loading ? (
              <div style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                Loading graph...
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px' }}>No suspicious transactions detected yet</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Graph will populate as flagged transactions occur</div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
                onWheel={handleWheel}
                style={{
                  cursor: isDragging ? (draggingNodeRef.current ? 'grabbing' : 'move') : 'default',
                  borderRadius: '12px',
                  width: '100%',
                  height: '480px',
                  display: 'block'
                }}
              />
            )}
            
            {/* Mini controls */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              display: 'flex',
              gap: '8px',
              background: 'rgba(10,10,15,0.8)',
              padding: '8px',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)'
            }}>
              <button onClick={() => setTransform({ ...transform, scale: transform.scale * 1.2 })}>+</button>
              <button onClick={() => setTransform({ ...transform, scale: transform.scale / 1.2 })}>-</button>
              <button onClick={() => setShowStats(!showStats)}>📊</button>
            </div>
          </div>

          <div>
            {/* Legend */}
            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>
                Legend
              </div>
              {[
                { color: 'var(--blue)', label: 'Suspicious user' },
                { color: 'var(--purple)', label: 'Payment recipient' },
                { color: 'var(--amber)', label: 'IP address node' },
                { color: 'var(--red)', label: 'High risk (score 60+)' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</span>
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '8px' }}>
                <span>💡 Click node to select • Drag to move • Scroll to zoom</span>
              </div>
            </div>

            {/* Selected node info */}
            {selectedNode && (
              <div className="card fade-in" style={{ padding: '16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Node Details
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>{selectedNode.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>
                  Type: <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{selectedNode.type}</span>
                </div>
                {selectedNode.risk > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>
                    Risk Score: <span style={{ color: selectedNode.risk >= 60 ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: '600' }}>{selectedNode.risk}</span>
                  </div>
                )}
                {selectedNode.status && (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>
                    Status: <span className={`badge badge-${selectedNode.status === 'blocked' ? 'red' : selectedNode.status === 'flagged' ? 'amber' : 'green'}`} style={{ fontSize: '10px' }}>{selectedNode.status}</span>
                  </div>
                )}
                
                {/* Connections */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }}>Connected to:</div>
                  {graphData.edges
                    .filter(e => e.from === selected || e.to === selected)
                    .map(e => {
                      const connectedId = e.from === selected ? e.to : e.from;
                      const connectedNode = graphData.nodes.find(n => n.id === connectedId);
                      return connectedNode && (
                        <div key={e.id || connectedId} style={{ fontSize: '11px', marginBottom: '3px', color: 'var(--text-2)' }}>
                          • {connectedNode.label} <span style={{ color: 'var(--text-3)' }}>({e.type})</span>
                        </div>
                      );
                    })}
                </div>
                
                {selectedNode.label?.includes('shared') && (
                  <div style={{ marginTop: '8px', background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'var(--red)' }}>
                    High-risk IP — shared by multiple suspicious users
                  </div>
                )}
              </div>
            )}

            {/* Graph Stats */}
            {showStats && (
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Graph Stats
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Nodes</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{graphData.nodes.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Connections</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{graphData.edges.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>High-risk nodes</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--red)' }}>{graphData.nodes.filter(n => n.risk >= 60).length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg connections</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      {graphData.nodes.length ? (graphData.edges.length / graphData.nodes.length).toFixed(1) : 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}