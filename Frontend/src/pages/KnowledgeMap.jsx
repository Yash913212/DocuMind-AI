import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Network,
  Zap,
  AlertTriangle,
  FileCode,
  Wrench,
  ExternalLink,
  ChevronRight,
  X,
  Compass,
} from "lucide-react";
import { API_BASE } from "../config";
import { useUI } from "../context/UIContext";

const CLUSTER_COLORS = [
  "#e10600", // Signal Red
  "#c0c0c0", // Moonlit Silver
  "#ffffff", // Luminous White
  "#ff453a", // Vivid Coral Red
  "#9c9ca3", // Muted Silver
];

const NODE_TYPE_CONFIG = {
  component: {
    color: "#c0c0c0", // Silver
    label: "Component",
    icon: Wrench,
    radius: 0.12,
  },
  specification: {
    color: "#8f8f8f", // Graphite Light
    label: "Specification",
    icon: Zap,
    radius: 0.08,
  },
  warning: {
    color: "#e10600", // Signal Red
    label: "Safety Warning",
    icon: AlertTriangle,
    radius: 0.1,
  },
  figure: {
    color: "#c0c0c0", // Silver
    label: "Figure / Schematic",
    icon: FileCode,
    radius: 0.09,
  },
  procedure: {
    color: "#a8a8a8", // Silver Dim
    label: "Procedure",
    icon: FileCode,
    radius: 0.08,
  },
};

// ── 3D Embedding Map Components ──

function InstancedPoints({ data, activeClusters, onHover, onClick }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current || data.length === 0) return;

    data.forEach((point, i) => {
      dummy.position.set(point.x, point.y, point.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const isActive = activeClusters.has(point.cluster);
      const hex = CLUSTER_COLORS[point.cluster % CLUSTER_COLORS.length];
      color.set(hex);

      if (!isActive) {
        color.lerp(new THREE.Color("#4a4a4a"), 0.8);
      }

      meshRef.current.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.instanceColor.needsUpdate = true;
  }, [data, activeClusters, dummy, color]);

  const handlePointerMove = (e) => {
    if (e.instanceId !== undefined) {
      e.stopPropagation();
      onHover(data[e.instanceId]);
    }
  };

  const handlePointerOut = () => {
    onHover(null);
  };

  const handleClick = (e) => {
    if (e.instanceId !== undefined) {
      e.stopPropagation();
      onClick(data[e.instanceId]);
    }
  };

  if (data.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, data.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function EmbeddingScene({
  data,
  activeClusters,
  setTooltipData,
  onPointClick,
  isMapActive,
}) {
  const controlsRef = useRef();
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const [isInteracting, setIsInteracting] = useState(false);
  const idleTimeout = useRef(null);

  const handleInteraction = () => {
    setIsInteracting(true);
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    idleTimeout.current = setTimeout(() => {
      setIsInteracting(false);
    }, 3000);
  };

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        autoRotate={!prefersReducedMotion && !isInteracting}
        autoRotateSpeed={0.5}
        onStart={handleInteraction}
        onChange={handleInteraction}
        enableDamping
        dampingFactor={0.05}
        enableZoom={isMapActive}
        enablePan={isMapActive}
      />
      <InstancedPoints
        data={data}
        activeClusters={activeClusters}
        onHover={setTooltipData}
        onClick={onPointClick}
      />
      <EffectComposer disableNormalPass>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.8}
          intensity={0.9}
        />
      </EffectComposer>
    </>
  );
}

function GraphEdgeLines({ edges, nodeMap, selectedNodeId }) {
  const lineGeometry = useMemo(() => {
    let validCount = 0;
    edges.forEach((edge) => {
      if (nodeMap[edge.source] && nodeMap[edge.target]) validCount++;
    });

    const positions = new Float32Array(validCount * 6);
    const colors = new Float32Array(validCount * 6);
    let pIdx = 0;
    let cIdx = 0;

    const connectedColor = new THREE.Color("#e10600");
    const normalColor = new THREE.Color("#4a4a4a");

    edges.forEach((edge) => {
      const src = nodeMap[edge.source];
      const tgt = nodeMap[edge.target];
      if (src && tgt) {
        positions[pIdx++] = src.x;
        positions[pIdx++] = src.y;
        positions[pIdx++] = src.z;
        positions[pIdx++] = tgt.x;
        positions[pIdx++] = tgt.y;
        positions[pIdx++] = tgt.z;

        const isConnected =
          selectedNodeId &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const col = isConnected ? connectedColor : normalColor;

        colors[cIdx++] = col.r;
        colors[cIdx++] = col.g;
        colors[cIdx++] = col.b;
        colors[cIdx++] = col.r;
        colors[cIdx++] = col.g;
        colors[cIdx++] = col.b;
      }
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [edges, nodeMap, selectedNodeId]);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.65}
        linewidth={1.5}
      />
    </lineSegments>
  );
}

function GraphNodeSphere({
  node,
  isSelected,
  isNeighbor,
  onHover,
  onClick,
}) {
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.component;
  const color = useMemo(() => new THREE.Color(config.color), [config.color]);

  const scale = isSelected ? 1.4 : isNeighbor ? 1.15 : 1.0;
  const opacity = !isSelected && !isNeighbor ? 0.8 : 1.0;

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node);
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[config.radius, 14, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.9 : 0.3}
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Selected Halo Ring */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[config.radius * 1.8, config.radius * 2.1, 32]} />
          <meshBasicMaterial
            color="#e10600"
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
}

function KnowledgeGraphScene({
  nodes,
  edges,
  nodeMap,
  selectedNode,
  onNodeSelect,
  setHoveredNode,
  isMapActive,
}) {
  const controlsRef = useRef();
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Set of neighbor node IDs
  const neighborIds = useMemo(() => {
    if (!selectedNode) return new Set();
    const set = new Set();
    edges.forEach((e) => {
      if (e.source === selectedNode.id) set.add(e.target);
      if (e.target === selectedNode.id) set.add(e.source);
    });
    return set;
  }, [selectedNode, edges]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      <OrbitControls
        ref={controlsRef}
        autoRotate={!prefersReducedMotion && !selectedNode}
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        enableZoom={isMapActive}
        enablePan={isMapActive}
      />

      <GraphEdgeLines
        edges={edges}
        nodeMap={nodeMap}
        selectedNodeId={selectedNode?.id}
      />

      {nodes.map((node) => (
        <GraphNodeSphere
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isNeighbor={neighborIds.has(node.id)}
          onHover={setHoveredNode}
          onClick={onNodeSelect}
        />
      ))}

      <EffectComposer disableNormalPass>
        <Bloom
          luminanceThreshold={0.25}
          luminanceSmoothing={0.8}
          intensity={0.8}
        />
      </EffectComposer>
    </>
  );
}

// ── Main KnowledgeMap Page ──

export function KnowledgeMap() {
  const [viewMode, setViewMode] = useState("graph"); // "graph" or "embeddings"
  const [isMapActive, setIsMapActive] = useState(false);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef);
  const { openInspector } = useUI();

  // Embeddings map state
  const [embeddingData, setEmbeddingData] = useState({ points: [], clusters: [] });
  const [activeClusters, setActiveClusters] = useState(new Set());
  const [embeddingTooltip, setEmbeddingTooltip] = useState(null);

  // Knowledge graph state
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Load embedding map
  useEffect(() => {
    const fetchMap = async () => {
      try {
        const res = await fetch(`${API_BASE}/map`);
        if (res.ok) {
          const json = await res.json();
          setEmbeddingData(json);
          setActiveClusters(new Set(json.clusters.map((c) => c.id)));
        }
      } catch (e) {
        console.error("Failed to load map data", e);
      }
    };
    fetchMap();
  }, []);

  // Load knowledge graph
  useEffect(() => {
    const fetchGraph = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/knowledge-graph`);
        if (res.ok) {
          const data = await res.json();
          setGraphData(data);
          // Default select the first component (e.g. Drive Motor M1)
          const firstComp =
            data.nodes?.find((n) => n.type === "component") || data.nodes?.[0];
          if (firstComp) {
            setSelectedNode(firstComp);
          }
        }
      } catch (e) {
        console.error("Failed to load knowledge graph", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGraph();
    window.addEventListener("documentUpdated", fetchGraph);
    return () => window.removeEventListener("documentUpdated", fetchGraph);
  }, []);

  // Compute 3D positions for graph nodes in a stable, organic layout
  const { positionedNodes, nodeMap } = useMemo(() => {
    const rawNodes = graphData.nodes || [];
    if (rawNodes.length === 0) return { positionedNodes: [], nodeMap: {} };

    const compNodes = rawNodes.filter((n) => n.type === "component");
    const otherNodes = rawNodes.filter((n) => n.type !== "component");

    const posNodes = [];
    const nMap = {};

    // 1. Arrange components on an inner sphere / circle
    compNodes.forEach((node, i) => {
      const angle = (i / Math.max(compNodes.length, 1)) * Math.PI * 2;
      const radius = 0.8 + (i % 2) * 0.2;
      const x = Math.cos(angle) * radius;
      const y = (i % 3 - 1) * 0.3;
      const z = Math.sin(angle) * radius;
      const pNode = { ...node, x, y, z };
      posNodes.push(pNode);
      nMap[node.id] = pNode;
    });

    // 2. Position other entities connected to components or in outer ring
    otherNodes.forEach((node, i) => {
      // Find connected component if any
      const edge = (graphData.edges || []).find(
        (e) => e.target === node.id || e.source === node.id
      );
      const parentId =
        edge?.source === node.id ? edge.target : edge?.source;
      const parent = parentId ? nMap[parentId] : null;

      let x, y, z;
      if (parent) {
        // Orbit around parent component
        const subAngle = (i * 1.618) % (Math.PI * 2);
        const subDist = 0.5 + (i % 3) * 0.15;
        x = parent.x + Math.cos(subAngle) * subDist;
        y = parent.y + (i % 2 === 0 ? 0.35 : -0.35);
        z = parent.z + Math.sin(subAngle) * subDist;
      } else {
        // Outer spherical distribution
        const phi = Math.acos(-1 + (2 * i) / Math.max(otherNodes.length, 1));
        const theta = Math.sqrt(otherNodes.length * Math.PI) * phi;
        const r = 1.6;
        x = r * Math.cos(theta) * Math.sin(phi);
        y = r * Math.sin(theta) * Math.sin(phi);
        z = r * Math.cos(phi);
      }

      const pNode = { ...node, x, y, z };
      posNodes.push(pNode);
      nMap[node.id] = pNode;
    });

    return { positionedNodes: posNodes, nodeMap: nMap };
  }, [graphData]);

  // Filtered nodes by entity type
  const displayedNodes = useMemo(() => {
    if (selectedTypeFilter === "all") return positionedNodes;
    return positionedNodes.filter((n) => n.type === selectedTypeFilter);
  }, [positionedNodes, selectedTypeFilter]);

  // Find relationships for the selected node
  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode || !graphData.edges) return [];
    return graphData.edges
      .filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id
      )
      .map((e) => {
        const isSource = e.source === selectedNode.id;
        const targetId = isSource ? e.target : e.source;
        const targetNode = nodeMap[targetId];
        return {
          edge: e,
          targetNode,
          relationship: e.relationship,
          label: e.label || e.relationship,
        };
      })
      .filter((r) => r.targetNode !== undefined);
  }, [selectedNode, graphData.edges, nodeMap]);

  const handlePointClick = (point) => {
    openInspector(`**${point.source}**\n\n${point.text}`);
  };

  const inspectNodeInDetail = (node) => {
    let content = `## ${node.label}\n\n`;
    content += `**Type:** ${node.type.toUpperCase()}\n`;
    if (node.page) content += `**Page:** ${node.page}\n`;
    if (node.document) content += `**Document:** ${node.document}\n\n`;
    content += `---\n\n${node.details || ""}\n\n`;

    // Append connected specifications and warnings
    if (selectedNodeRelationships.length > 0) {
      content += `### Connected Engineering Elements:\n`;
      selectedNodeRelationships.forEach((rel) => {
        content += `- **${rel.label}**: ${rel.targetNode.label} (${rel.targetNode.type})\n`;
      });
    }

    openInspector(content);
  };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full relative bg-ink transition-all duration-500 ${
        isMapActive ? "ring-inset ring-2 ring-brass/50" : ""
      }`}
    >
      {/* Header Overlay */}
      <div className="absolute top-4 sm:top-8 left-4 sm:left-8 z-10 pointer-events-none max-w-sm sm:max-w-xl">
        <div className="flex items-center gap-2 mb-2 pointer-events-auto">
          <div className="p-1.5 rounded-lg bg-brass/15 border border-brass/40 text-brass shadow-md shadow-brass/20">
            <Network size={18} />
          </div>
          <h1 className="font-hero text-2xl sm:text-3xl text-parchment">
            Knowledge Map & Graph
          </h1>
        </div>
        <p className="font-body text-fog text-xs sm:text-sm mb-3">
          {viewMode === "graph"
            ? "Interactive 3D Engineering Knowledge Graph connecting components, specifications, wiring diagrams, maintenance procedures, and safety warnings."
            : "Semantic landscape showing AI embedding clusters across technical manuals."}
        </p>

        {/* View Mode Toggle */}
        <div className="flex bg-ink/90 p-1 rounded-xl border border-brass/20 pointer-events-auto w-fit shadow-xl backdrop-blur-md">
          <button
            onClick={() => setViewMode("graph")}
            className={`px-3 py-1.5 rounded-lg font-ui-label text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === "graph"
                ? "bg-brass text-white font-semibold shadow-md shadow-brass/25"
                : "text-fog hover:text-parchment"
            }`}
          >
            <Network size={14} /> Knowledge Graph
          </button>
          <button
            onClick={() => setViewMode("embeddings")}
            className={`px-3 py-1.5 rounded-lg font-ui-label text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === "embeddings"
                ? "bg-brass text-white font-semibold shadow-md shadow-brass/25"
                : "text-fog hover:text-parchment"
            }`}
          >
            <Compass size={14} /> Embedding Atlas
          </button>
        </div>
      </div>

      {/* Knowledge Graph Filter Bar (Top Center) */}
      {viewMode === "graph" && (
        <div className="absolute top-4 sm:top-8 right-4 sm:right-8 z-10 flex flex-wrap gap-1.5 max-w-md justify-end pointer-events-auto">
          {[
            { id: "all", label: "All Types" },
            { id: "component", label: "Components" },
            { id: "specification", label: "Specs" },
            { id: "warning", label: "Warnings" },
            { id: "figure", label: "Figures" },
            { id: "procedure", label: "SOPs" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedTypeFilter(type.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-ui-label uppercase tracking-wider transition-colors ${
                selectedTypeFilter === type.id
                  ? "bg-indigo text-brass border border-brass/40 shadow"
                  : "bg-ink/80 text-fog hover:text-parchment border border-fog/10"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      {/* Selected Entity Navigation Panel (Right Drawer) */}
      <AnimatePresence>
        {viewMode === "graph" && selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute bottom-4 sm:bottom-8 right-4 sm:right-8 z-20 w-80 sm:w-96 bg-indigo/95 backdrop-blur-xl p-5 rounded-2xl border border-brass/30 shadow-2xl space-y-4 max-h-[75vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2 border-b border-fog/10 pb-3">
              <div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-data-mono uppercase tracking-wider inline-block mb-1 font-semibold"
                  style={{
                    backgroundColor: `${
                      NODE_TYPE_CONFIG[selectedNode.type]?.color || "#e10600"
                    }20`,
                    color:
                      NODE_TYPE_CONFIG[selectedNode.type]?.color || "#e10600",
                    border: `1px solid ${
                      NODE_TYPE_CONFIG[selectedNode.type]?.color || "#e10600"
                    }40`,
                  }}
                >
                  {NODE_TYPE_CONFIG[selectedNode.type]?.label ||
                    selectedNode.type}
                </span>
                <h3 className="font-hero text-xl text-parchment font-medium">
                  {selectedNode.label}
                </h3>
                {selectedNode.page && (
                  <span className="font-data-mono text-[11px] text-fog">
                    Source: {selectedNode.document || "Manual"} • Page{" "}
                    {selectedNode.page}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-fog hover:text-parchment p-1 rounded-lg hover:bg-ink/40"
              >
                <X size={16} />
              </button>
            </div>

            {selectedNode.details && (
              <p className="text-xs text-parchment/80 leading-relaxed bg-ink/40 p-3 rounded-xl border border-fog/10">
                {selectedNode.details}
              </p>
            )}

            {/* Explicit Relationships: Motor -> Wiring Diagram, Rated Voltage, Warning, Maintenance */}
            <div className="space-y-2">
              <span className="font-ui-label text-[11px] uppercase tracking-wider text-fog block">
                Explicit Relationships ({selectedNodeRelationships.length})
              </span>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {selectedNodeRelationships.length > 0 ? (
                  selectedNodeRelationships.map((rel, idx) => {
                    const tgtConfig =
                      NODE_TYPE_CONFIG[rel.targetNode.type] ||
                      NODE_TYPE_CONFIG.component;
                    const TgtIcon = tgtConfig.icon;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedNode(rel.targetNode)}
                        className="w-full text-left p-2.5 rounded-xl bg-ink/60 hover:bg-ink border border-fog/10 hover:border-brass/30 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="p-1 rounded-md shrink-0"
                            style={{
                              backgroundColor: `${tgtConfig.color}20`,
                              color: tgtConfig.color,
                            }}
                          >
                            <TgtIcon size={14} />
                          </span>
                          <div className="min-w-0">
                            <span className="text-[10px] font-data-mono uppercase tracking-wider text-brass block truncate">
                              {rel.label}
                            </span>
                            <span className="text-xs text-parchment block truncate font-medium group-hover:text-brass transition-colors">
                              {rel.targetNode.label}
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-fog group-hover:text-brass group-hover:translate-x-0.5 transition-all shrink-0"
                        />
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-fog italic py-2">
                    No explicit relationship edges mapped.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-fog/10 flex justify-end">
              <button
                onClick={() => inspectNodeInDetail(selectedNode)}
                className="btn-signal w-full py-2.5 rounded-xl font-ui-label text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 font-semibold text-white shadow-md hover:scale-[1.01] active:scale-[0.99]"
              >
                <ExternalLink size={14} /> Open in Document Inspector
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover Tooltip in Knowledge Graph */}
      {viewMode === "graph" && hoveredNode && !selectedNode && (
        <div className="absolute bottom-6 left-6 z-10 bg-indigo/90 p-3 rounded-xl border border-brass/20 backdrop-blur-md pointer-events-none max-w-xs shadow-xl">
          <span className="text-[10px] font-data-mono text-brass uppercase block">
            {hoveredNode.type}
          </span>
          <span className="text-sm font-hero text-parchment font-medium block">
            {hoveredNode.label}
          </span>
          <span className="text-xs text-fog mt-1 block">Click to explore relationships</span>
        </div>
      )}

      {/* Hover Tooltip in Embedding Atlas */}
      {viewMode === "embeddings" && embeddingTooltip && !selectedNode && (
        <div className="absolute bottom-6 left-6 z-10 bg-indigo/90 p-3 rounded-xl border border-brass/20 backdrop-blur-md pointer-events-none max-w-xs shadow-xl">
          <span className="text-[10px] font-data-mono text-brass uppercase block">
            {embeddingTooltip.chunk_type || "chunk"}
          </span>
          <span className="text-sm font-hero text-parchment font-medium block">
            {embeddingTooltip.source || "Unknown document"}
          </span>
          <span className="text-xs text-fog mt-1 block line-clamp-2">
            {embeddingTooltip.text}
          </span>
        </div>
      )}

      {/* 3D Canvas Rendering */}
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center font-data-mono text-fog">
          <div className="animate-pulse">Building Engineering Knowledge Graph...</div>
          <div className="text-xs opacity-60">
            Mapping components, specifications, diagrams, and safety warnings.
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center font-data-mono text-fog">
              Rendering 3D scene...
            </div>
          }
        >
          {viewMode === "graph" && displayedNodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-data-mono text-fog">
              <span>No knowledge graph available.</span>
              <span className="text-xs opacity-60">
                Upload and index a document to generate entities and relationships.
              </span>
            </div>
          ) : viewMode === "embeddings" && embeddingData.points.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-data-mono text-fog">
              <span>No embedding points available.</span>
              <span className="text-xs opacity-60">
                Upload and index a document to build the semantic atlas.
              </span>
            </div>
          ) : (
            <>
              {!isMapActive && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center bg-transparent cursor-pointer"
                  onClick={() => setIsMapActive(true)}
                >
                  <div className="px-6 py-3 bg-indigo/80 backdrop-blur border border-brass/30 text-parchment rounded-full font-ui-label flex items-center gap-2 shadow-xl animate-pulse pointer-events-none">
                    Click to interact with 3D Graph
                  </div>
                </div>
              )}

              <Canvas
                camera={{ position: [0, 0, 3] }}
                onPointerMissed={() => setIsMapActive(false)}
                frameloop={isInView ? "always" : "demand"}
                gl={{ powerPreference: "high-performance", antialias: true }}
                dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)]}
              >
                {viewMode === "graph" ? (
                  <KnowledgeGraphScene
                    nodes={displayedNodes}
                    edges={graphData.edges || []}
                    nodeMap={nodeMap}
                    selectedNode={selectedNode}
                    onNodeSelect={setSelectedNode}
                    setHoveredNode={setHoveredNode}
                    isMapActive={isMapActive}
                  />
                ) : (
                  <EmbeddingScene
                    data={embeddingData.points}
                    activeClusters={activeClusters}
                    setTooltipData={setEmbeddingTooltip}
                    onPointClick={handlePointClick}
                    isMapActive={isMapActive}
                  />
                )}
              </Canvas>
            </>
          )}
        </Suspense>
      )}
    </div>
  );
}
