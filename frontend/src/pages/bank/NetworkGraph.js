import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';

/* ─── Animation injection ─── */
function injectAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vault-graph-anim')) return;
  const s = document.createElement('style');
  s.id = 'vault-graph-anim';
  s.textContent = `
    @keyframes graphShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    @keyframes graphFadeUp {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes graphSlideIn {
      from { opacity:0; transform:translateX(8px); }
      to   { opacity:1; transform:translateX(0); }
    }
    .graph-control-btn {
      width: 32px; height: 32px; border-radius: 8px;
      border: 1px solid rgba(15,23,42,0.1);
      background: #fff; color: #1A1F2E;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; font-weight: 700;
      transition: all 0.15s ease;
      box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    }
    .graph-control-btn:hover {
      background: #1A1F2E; color: #fff;
    }
  `;
  document.head.appendChild(s);
}

/* ─── Sub-components ─── */
function InfoRow({ label, value, mono, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <span style={{ fontSize: '12px', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '600', color: valueColor || '#1A1F2E', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: `0 0 0 3px ${color}25`,
      }} />
      <span style={{ fontSize: '12px', color: '#475569' }}>{label}</span>
    </div>
  );
}

function Pill({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
      borderRadius: '20px', background: bg, color, fontSize: '11px', fontWeight: '600',
      textTransform: 'capitalize',
    }}>{label}</span>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function NetworkGraph() {
  const [graphData,  setGraphData]  = useState({ nodes: [], edges: [] });
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [hovered,    setHovered]    = useState(null);
  const [transform,  setTransform]  = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart,  setDragStart]  = useState({ x: 0, y: 0 });
  const [showStats,  setShowStats]  = useState(true);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const posRef       = useRef({});
  const draggingNodeRef   = useRef(null);
  const animationFrameRef = useRef(null);

  const simulationRef = useRef({ repulsion: 1000, attraction: 0.1, damping: 0.9, iterations: 0 });

  injectAnim();

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

  /* ── Canvas resize & position init (unchanged logic) ── */
  useEffect(() => {
    if (!graphData.nodes.length) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    if (Object.keys(posRef.current).length === 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.35;

      const userNodes      = graphData.nodes.filter(n => n.type === 'user');
      const recipientNodes = graphData.nodes.filter(n => n.type === 'recipient');
      const ipNodes        = graphData.nodes.filter(n => n.type === 'ip');

      userNodes.forEach((n, i) => {
        const angle = (i / userNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { x: centerX + radius * 0.6 * Math.cos(angle), y: centerY + radius * 0.6 * Math.sin(angle) };
      });
      recipientNodes.forEach((n, i) => {
        const angle = (i / recipientNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { x: centerX + radius * 0.8 * Math.cos(angle), y: centerY + radius * 0.8 * Math.sin(angle) };
      });
      ipNodes.forEach((n, i) => {
        const angle = (i / ipNodes.length) * Math.PI * 2;
        posRef.current[n.id] = { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
      });
    }

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [graphData]);

  /* ── Force simulation (unchanged logic) ── */
  useEffect(() => {
    if (!graphData.nodes.length) return;

    const simulateForces = () => {
      let positions = { ...posRef.current };
      const { nodes, edges } = graphData;
      const { repulsion, attraction } = simulationRef.current;

      nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos || draggingNodeRef.current === node.id) return;

        let fx = 0, fy = 0;

        nodes.forEach(other => {
          if (node.id === other.id) return;
          const otherPos = positions[other.id];
          if (!otherPos) return;
          const dx = pos.x - otherPos.x, dy = pos.y - otherPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        edges.filter(e => e.from === node.id || e.to === node.id).forEach(edge => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const otherPos = positions[otherId];
          if (!otherPos) return;
          const dx = otherPos.x - pos.x, dy = otherPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist * attraction;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        pos.x += fx * simulationRef.current.damping;
        pos.y += fy * simulationRef.current.damping;

        const padding = 50;
        pos.x = Math.max(padding, Math.min(canvasRef.current.width  - padding, pos.x));
        pos.y = Math.max(padding, Math.min(canvasRef.current.height - padding, pos.y));
      });

      posRef.current = positions;
      simulationRef.current.iterations++;
      if (simulationRef.current.iterations < 100) {
        animationFrameRef.current = requestAnimationFrame(simulateForces);
      } else {
        simulationRef.current.iterations = 0;
      }
    };

    animationFrameRef.current = requestAnimationFrame(simulateForces);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [graphData]);

  /* ── Draw function — updated palette for white theme ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    /* White/cream background */
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, W / transform.scale, H / transform.scale);

    /* Subtle dot grid */
    ctx.fillStyle = 'rgba(15,23,42,0.07)';
    const gridSpacing = 28;
    for (let gx = 0; gx < W / transform.scale; gx += gridSpacing) {
      for (let gy = 0; gy < H / transform.scale; gy += gridSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Draw edges */
    graphData.edges.forEach(e => {
      const from = posRef.current[e.from];
      const to   = posRef.current[e.to];
      if (!from || !to) return;

      const isHighlighted = (hovered && (e.from === hovered || e.to === hovered)) ||
                            (selected && (e.from === selected || e.to === selected));

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = e.type === 'ip_link'
        ? `rgba(201,168,76,${isHighlighted ? 0.7 : 0.25})`
        : `rgba(100,116,139,${isHighlighted ? 0.55 : 0.18})`;
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.setLineDash(e.type === 'ip_link' ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Edge label */
      if (e.label && isHighlighted) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        ctx.save();
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(e.label);
        ctx.fillStyle = 'rgba(250,250,250,0.95)';
        ctx.beginPath();
        ctx.roundRect(midX - metrics.width / 2 - 5, midY - 8, metrics.width + 10, 16, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(15,23,42,0.6)';
        ctx.fillText(e.label, midX, midY);
        ctx.restore();
      }
    });

    /* Draw nodes */
    graphData.nodes.forEach(n => {
      const pos = posRef.current[n.id];
      if (!pos) return;

      const isSelected = selected === n.id;
      const isHov      = hovered  === n.id;
      const r          = n.type === 'user' ? 14 : n.type === 'recipient' ? 11 : 8;

      let color;
      if (n.risk >= 60) color = '#DC2626';
      else switch (n.type) {
        case 'ip':        color = '#C9A84C'; break;
        case 'recipient': color = '#7C3AED'; break;
        default:          color = '#2563EB';
      }

      /* Glow for high-risk */
      if (n.risk >= 60) { ctx.shadowColor = '#DC2626'; ctx.shadowBlur = 18; }
      else if (isSelected || isHov) { ctx.shadowColor = color; ctx.shadowBlur = 10; }

      /* Node fill */
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(pos.x - 2, pos.y - 3, 2, pos.x, pos.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, `${color}33`);
      grad.addColorStop(1, `${color}22`);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Node border */
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : isHov ? 2 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Selection ring */
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      /* Label */
      let label = n.label || n.id;
      if (label.length > 15) label = label.slice(0, 13) + '…';

      ctx.font = `${isSelected ? '600 ' : ''}10px -apple-system, sans-serif`;
      ctx.textAlign = 'center';

      const metrics = ctx.measureText(label);
      const lw = metrics.width + 8;
      const lx = pos.x - lw / 2;
      const ly = pos.y + r + 4;

      ctx.fillStyle = 'rgba(250,250,250,0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, lw, 14, 3);
      else ctx.rect(lx, ly, lw, 14);
      ctx.fill();

      ctx.fillStyle = isHov || isSelected ? color : 'rgba(15,23,42,0.55)';
      ctx.fillText(label, pos.x, ly + 10);
    });

    ctx.restore();

    /* Zoom indicator */
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(100,116,139,0.5)';
    ctx.fillText(`${Math.round(transform.scale * 100)}%`, 12, 20);
    ctx.restore();
  }, [graphData, selected, hovered, transform]);

  /* ── Animation loop (unchanged) ── */
  useEffect(() => {
    let animationId;
    const animate = () => { draw(); animationId = requestAnimationFrame(animate); };
    animate();
    return () => { if (animationId) cancelAnimationFrame(animationId); };
  }, [draw]);

  /* ── Event handlers (unchanged logic) ── */
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top  - transform.offsetY) / transform.scale;

    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      if (Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < 20) {
        draggingNodeRef.current = n.id;
        setIsDragging(true);
        setDragStart({ x: mx - pos.x, y: my - pos.y });
        return;
      }
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.offsetX, y: e.clientY - transform.offsetY });
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top  - transform.offsetY) / transform.scale;

    let hoveredNode = null;
    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      if (Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < 20) { hoveredNode = n.id; break; }
    }
    setHovered(hoveredNode);

    if (isDragging) {
      if (draggingNodeRef.current) {
        const nodePos = posRef.current[draggingNodeRef.current];
        if (nodePos) { nodePos.x = mx - dragStart.x; nodePos.y = my - dragStart.y; }
      } else {
        setTransform({ ...transform, offsetX: e.clientX - dragStart.x, offsetY: e.clientY - dragStart.y });
      }
    }
  };

  const handleMouseUp = () => { setIsDragging(false); draggingNodeRef.current = null; };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta    = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale * delta));
    const rect     = canvasRef.current.getBoundingClientRect();
    const mouseX   = e.clientX - rect.left;
    const mouseY   = e.clientY - rect.top;
    const sc       = newScale / transform.scale;
    setTransform({ scale: newScale, offsetX: mouseX - (mouseX - transform.offsetX) * sc, offsetY: mouseY - (mouseY - transform.offsetY) * sc });
  };

  const handleClick = (e) => {
    if (isDragging) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.offsetX) / transform.scale;
    const my = (e.clientY - rect.top  - transform.offsetY) / transform.scale;

    for (const n of graphData.nodes) {
      const pos = posRef.current[n.id];
      if (!pos) continue;
      if (Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < 20) {
        setSelected(selected === n.id ? null : n.id);
        return;
      }
    }
    setSelected(null);
  };

  const resetView = () => setTransform({ scale: 1, offsetX: 0, offsetY: 0 });

  const selectedNode = selected ? graphData.nodes.find(n => n.id === selected) : null;

  const nodeColor = (node) => {
    if (node.risk >= 60) return '#DC2626';
    switch (node.type) {
      case 'ip':        return '#C9A84C';
      case 'recipient': return '#7C3AED';
      default:          return '#2563EB';
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: '1200px', animation: 'graphFadeUp 0.4s ease both' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A1F2E', letterSpacing: '-0.5px', marginBottom: '3px' }}>
              Network Analysis
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>
              Visual map of suspicious transactions, shared devices and IP clusters
            </p>
          </div>

          <button
            onClick={resetView}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
              background: '#fff', border: '1px solid rgba(15,23,42,0.1)',
              fontSize: '12px', fontWeight: '600', color: '#1A1F2E',
              boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              transition: 'all 0.15s ease', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A1F2E'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1A1F2E'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.33"/>
            </svg>
            Reset View
          </button>
        </div>

        {/* ── Main layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>

          {/* Canvas card */}
          <div
            ref={containerRef}
            style={{
              background: '#fff',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.04)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {loading ? (
              <div style={{
                height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '12px',
                background: 'linear-gradient(90deg, #f5f5f5 25%, #fafafa 50%, #f5f5f5 75%)',
                backgroundSize: '200% 100%',
                animation: 'graphShimmer 1.8s ease-in-out infinite',
              }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(15,23,42,0.08)', borderTopColor: '#C9A84C', animation: 'spin 0.9s linear infinite' }} />
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Building network map...</span>
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(15,23,42,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                    <circle cx="12" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><circle cx="5" cy="19" r="3"/>
                    <line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="13" x2="19" y2="16"/><line x1="12" y1="13" x2="5" y2="16"/>
                  </svg>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1F2E' }}>No network data yet</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', maxWidth: '240px', lineHeight: 1.5 }}>
                  Graph will populate as flagged transactions are detected
                </div>
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
                  cursor: isDragging ? (draggingNodeRef.current ? 'grabbing' : 'move') : hovered ? 'pointer' : 'default',
                  width: '100%', height: '500px', display: 'block',
                }}
              />
            )}

            {/* Floating controls */}
            {!loading && graphData.nodes.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '14px', right: '14px',
                display: 'flex', flexDirection: 'column', gap: '5px',
                background: 'rgba(255,255,255,0.95)', padding: '6px',
                borderRadius: '10px', border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 2px 12px rgba(15,23,42,0.08)',
                backdropFilter: 'blur(8px)',
              }}>
                <button
                  className="graph-control-btn"
                  onClick={() => setTransform(t => ({ ...t, scale: Math.min(3, t.scale * 1.25) }))}
                  title="Zoom in"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button
                  className="graph-control-btn"
                  onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.5, t.scale / 1.25) }))}
                  title="Zoom out"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div style={{ height: '1px', background: 'rgba(15,23,42,0.07)', margin: '1px 0' }} />
                <button
                  className="graph-control-btn"
                  onClick={() => setShowStats(s => !s)}
                  title="Toggle stats"
                  style={{ background: showStats ? '#1A1F2E' : '#fff', color: showStats ? '#fff' : '#1A1F2E' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </button>
              </div>
            )}

            {/* Interaction hint */}
            {!loading && graphData.nodes.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '14px', left: '14px',
                fontSize: '10px', color: '#94A3B8',
                background: 'rgba(255,255,255,0.85)', padding: '5px 10px',
                borderRadius: '8px', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(15,23,42,0.06)',
              }}>
                Click to select · Drag to pan · Scroll to zoom
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'graphSlideIn 0.4s ease 0.1s both' }}>

            {/* Legend */}
            <div style={{
              background: '#fff', border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: '14px', padding: '18px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                Legend
              </div>
              <LegendDot color="#2563EB" label="Suspicious account" />
              <LegendDot color="#7C3AED" label="Payment recipient" />
              <LegendDot color="#C9A84C" label="IP address node" />
              <LegendDot color="#DC2626" label="High risk (score 60+)" />
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(15,23,42,0.06)', fontSize: '11px', color: '#94A3B8', lineHeight: 1.6 }}>
                Dashed lines indicate shared IP connections
              </div>
            </div>

            {/* Selected node */}
            {selectedNode && (
              <div style={{
                background: '#fff', border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: '14px', padding: '18px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
                animation: 'graphSlideIn 0.2s ease',
                borderLeft: `3px solid ${nodeColor(selectedNode)}`,
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  Node Details
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1F2E', marginBottom: '10px' }}>
                  {selectedNode.label || selectedNode.id}
                </div>

                <InfoRow label="Type"  value={selectedNode.type}  />
                {selectedNode.risk > 0 && (
                  <InfoRow
                    label="Risk Score"
                    value={selectedNode.risk}
                    mono
                    valueColor={selectedNode.risk >= 60 ? '#DC2626' : selectedNode.risk >= 30 ? '#D97706' : '#059669'}
                  />
                )}
                {selectedNode.status && (
                  <div style={{ padding: '7px 0', borderBottom: '1px solid rgba(15,23,42,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Status</span>
                    <Pill
                      label={selectedNode.status}
                      color={selectedNode.status === 'blocked' ? '#DC2626' : selectedNode.status === 'flagged' ? '#D97706' : '#059669'}
                      bg={selectedNode.status === 'blocked' ? 'rgba(220,38,38,0.08)' : selectedNode.status === 'flagged' ? 'rgba(217,119,6,0.08)' : 'rgba(5,150,105,0.08)'}
                    />
                  </div>
                )}

                {/* Connections */}
                {graphData.edges.filter(e => e.from === selected || e.to === selected).length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Connected Nodes
                    </div>
                    {graphData.edges
                      .filter(e => e.from === selected || e.to === selected)
                      .map(e => {
                        const cId   = e.from === selected ? e.to : e.from;
                        const cNode = graphData.nodes.find(n => n.id === cId);
                        return cNode && (
                          <div key={e.id || cId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{cNode.label}</span>
                            <span style={{ color: '#94A3B8', flexShrink: 0 }}>{e.type}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                )}

                {selectedNode.label?.includes('shared') && (
                  <div style={{ marginTop: '12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.12)', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: '#DC2626', lineHeight: 1.5 }}>
                    High-risk IP — shared by multiple suspicious accounts
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            {showStats && (
              <div style={{
                background: '#fff', border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: '14px', padding: '18px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  Graph Stats
                </div>
                <InfoRow label="Total nodes"       value={graphData.nodes.length} mono />
                <InfoRow label="Connections"        value={graphData.edges.length} mono />
                <InfoRow
                  label="High-risk nodes"
                  value={graphData.nodes.filter(n => n.risk >= 60).length}
                  mono
                  valueColor={graphData.nodes.filter(n => n.risk >= 60).length > 0 ? '#DC2626' : '#059669'}
                />
                <InfoRow
                  label="Avg connections"
                  value={graphData.nodes.length ? (graphData.edges.length / graphData.nodes.length).toFixed(1) : '0.0'}
                  mono
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}