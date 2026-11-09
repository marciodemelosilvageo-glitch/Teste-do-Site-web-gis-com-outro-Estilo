/* eslint-disable */
// Globe — Originkit (Enhanced for WebGIS with caching & transparent background)

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    SphereGeometry,
    MeshBasicMaterial,
    Color,
    Mesh,
    Group,
    InstancedMesh,
    Matrix4,
    Raycaster,
    Vector2,
    TubeGeometry,
    CatmullRomCurve3,
    Vector3,
    CanvasTexture,
    SRGBColorSpace,
} from "three";
import { geoEquirectangular, geoPath } from "d3-geo";

type Rgba = { r: number; g: number; b: number; a: number };

// Cache em memória para carregar o GeoJSON do mapa apenas uma vez
let cachedLandFeatures: any = null;
let landFeaturesPromise: Promise<any> | null = null;

const getLandFeatures = async (): Promise<any> => {
    if (cachedLandFeatures) return cachedLandFeatures;
    if (!landFeaturesPromise) {
        // Carrega o GeoJSON 110m ultraleve (~237 KB) servido localmente na pasta public/
        const localUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL)
            ? `${import.meta.env.BASE_URL.replace(/\/$/, "")}/ne_110m_land.json`
            : "/ne_110m_land.json";

        landFeaturesPromise = fetch(localUrl)
            .then((res) => {
                if (!res.ok) {
                    // Fallback para CDN externo se necessário
                    return fetch(
                        "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
                    );
                }
                return res;
            })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load land data");
                return res.json();
            })
            .then((data) => {
                cachedLandFeatures = data;
                return data;
            })
            .catch((err) => {
                landFeaturesPromise = null;
                throw err;
            });
    }
    return landFeaturesPromise;
};

function parseColorToRgba(input: string): Rgba {
    if (!input || input.trim() === "") return { r: 0, g: 0, b: 0, a: 0 };
    const str = input.trim();
    if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const rgbaMatch = str.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
    );
    if (rgbaMatch) {
        const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255;
        const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255;
        const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255;
        const a =
            rgbaMatch[4] !== undefined
                ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4])))
                : 1;
        return { r, g, b, a };
    }
    const hex = str.replace(/^#/, "");
    if (hex.length === 8) {
        return {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
            a: parseInt(hex.slice(6, 8), 16) / 255,
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
            a: 1,
        };
    }
    if (hex.length === 4) {
        return {
            r: parseInt(hex[0] + hex[0], 16) / 255,
            g: parseInt(hex[1] + hex[1], 16) / 255,
            b: parseInt(hex[2] + hex[2], 16) / 255,
            a: parseInt(hex[3] + hex[3], 16) / 255,
        };
    }
    if (hex.length === 3) {
        return {
            r: parseInt(hex[0] + hex[0], 16) / 255,
            g: parseInt(hex[1] + hex[1], 16) / 255,
            b: parseInt(hex[2] + hex[2], 16) / 255,
            a: 1,
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbaToColor(rgba: Rgba): Color {
    return new Color(rgba.r, rgba.g, rgba.b);
}

function mapLinear(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return outMin + t * (outMax - outMin);
}

function mapSpeedUiToInternal(ui: number): number {
    if (ui === 0) return 0;
    const clamped = Math.max(0, Math.min(10, ui));
    return mapLinear(clamped, 0, 10, 0, 0.9);
}
function mapDensityUiToSpacing(ui: number): number {
    const clamped = Math.max(1, Math.min(10, ui));
    return mapLinear(clamped, 1, 10, 24, 8);
}
function mapScaleUiToMultiplier(ui: number): number {
    const clamped = Math.max(1, Math.min(20, ui));
    return mapLinear(clamped, 1, 20, 0.2, 2);
}
function mapDotSizeUiToMultiplier(ui: number): number {
    const clamped = Math.max(1, Math.min(10, ui));
    return mapLinear(clamped, 1, 10, 0.1, 0.5);
}
function mapMarkerDotSizeUiToMultiplier(ui: number): number {
    const clamped = Math.max(0, Math.min(100, ui));
    return mapLinear(clamped, 0, 100, 0.1, 2.5);
}
function normalizeSmoothing(ui: number): number {
    return Math.max(0, Math.min(1, ui / 10));
}
function mapDragSpeedUiToSensitivity(ui: number): number {
    return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0.001, 0.02);
}
function mapDetailToStepSize(ui: number): number {
    const clamped = Math.max(1, Math.min(10, ui));
    return mapLinear(clamped, 1, 10, 10, 1);
}

function simplifyRing(ring: number[][], detail: number): number[][] {
    if (ring.length < 2) return ring;
    if (detail >= 10) return ring;
    const stepSize = Math.max(1, Math.floor(mapDetailToStepSize(detail)));
    const simplified: number[][] = [];
    simplified.push(ring[0]);
    for (let i = stepSize; i < ring.length - 1; i += stepSize) {
        const idx = Math.min(i, ring.length - 1);
        simplified.push(ring[idx]);
    }
    const lastPoint = ring[ring.length - 1];
    const firstPoint = ring[0];
    const isClosed =
        Math.abs(lastPoint[0] - firstPoint[0]) < 1e-4 &&
        Math.abs(lastPoint[1] - firstPoint[1]) < 1e-4;
    if (!isClosed) {
        simplified.push(lastPoint);
    }
    return simplified.length >= 2 ? simplified : ring;
}

function latLngToPosition(
    lat: number,
    lng: number
): { x: number; y: number; z: number } {
    const latRad = lat * (Math.PI / 180);
    const lngRad = lng * (Math.PI / 180);
    const x = Math.cos(latRad) * Math.sin(lngRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.cos(lngRad);
    return { x, y, z };
}

interface Marker {
    lat: number;
    lng: number;
}
interface MarkerConfig {
    markers: Marker[];
    color: string;
    size: number;
}
interface DotsConfig {
    color: string;
    size: number;
    density: number;
    allDots: boolean;
}
export interface GlobeProps {
    speed?: number;
    smoothing?: number;
    dots?: DotsConfig;
    fill?: "dots" | "solid";
    fillColor?: string;
    scale?: number;
    stopOnHover?: boolean;
    markerConfig?: MarkerConfig;
    direction?: "left" | "right";
    initialLatitude?: number;
    initialLongitude?: number;
    oceanColor?: string;
    outlineColor?: string;
    showOutline?: boolean;
    graticuleColor?: string;
    showGrid?: boolean;
    outlineWidth?: number;
    dragSpeed?: number;
    detail?: number;
    style?: CSSProperties;
    className?: string;
}

export default function Globe({
    speed = 2,
    smoothing = 8,
    dots = { color: "#007AFF", size: 5, density: 8, allDots: false },
    fill = "dots",
    fillColor = "#007AFF",
    scale = 8,
    stopOnHover = false,
    markerConfig = { markers: [{ lat: -5.09, lng: -42.8 }], color: "#FF3B30", size: 50 },
    direction = "left",
    initialLatitude = -5,
    initialLongitude = -42,
    oceanColor = "transparent",
    outlineColor = "#007AFF",
    showOutline = true,
    graticuleColor = "rgba(0, 122, 255, 0.15)",
    showGrid = true,
    outlineWidth = 1,
    dragSpeed = 5,
    detail = 5,
    style,
    className,
}: GlobeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Suporte a preferência de menos movimento (acessibilidade / dispositivos modestos)
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dotColor = dots.color;
    const dotSize = dots.size;
    const density = dots.density;
    const allDots = dots.allDots;
    const markerColor = markerConfig.color;
    const markerSize = markerConfig.size;
    const markerCount = markerConfig.markers?.length || 0;
    const gridWidth = 1;
    const smoothingN = normalizeSmoothing(smoothing);

    const baseRotationSpeed = mapSpeedUiToInternal(speed);
    const rotationSpeed =
        direction === "left" ? -baseRotationSpeed : baseRotationSpeed;
    const dotSpacing = mapDensityUiToSpacing(density);
    const dotSizeMultiplier = mapDotSizeUiToMultiplier(dotSize);
    const markerRadiusMultiplier = mapMarkerDotSizeUiToMultiplier(
        markerSize
    );
    const scaleMultiplier = mapScaleUiToMultiplier(scale);

    useEffect(() => {
        if (prefersReducedMotion) return;
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerWidth =
            container.clientWidth || container.offsetWidth || 100;
        const containerHeight =
            container.clientHeight || container.offsetHeight || 100;

        const scene = new Scene();
        const camera = new PerspectiveCamera(
            50,
            containerWidth / containerHeight,
            0.1,
            1e3
        );
        const baseRadius = 1;
        const globeRadius = baseRadius * scaleMultiplier;
        const cameraDistance = 2.5 / scaleMultiplier;
        camera.position.set(0, 0, cameraDistance);
        camera.lookAt(0, 0, 0);

        // Desliga antialias e limita o pixelRatio a 1.5 para economizar GPU/bateria
        const renderer = new WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: "low-power"
        });
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = SRGBColorSpace;
        const canvas = renderer.domElement;
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.opacity = "0";
        canvas.style.visibility = "hidden";
        container.appendChild(canvas);

        const resolvedOceanColor = oceanColor;
        const resolvedOutlineColor = outlineColor;
        const resolvedDotColor = dotColor;
        const resolvedMarkerColor = markerConfig.color;
        const resolvedGraticuleColor = graticuleColor;
        const resolvedFillColor = fillColor;
        const oceanRgba = parseColorToRgba(resolvedOceanColor);
        const outlineRgba = parseColorToRgba(resolvedOutlineColor);
        const dotRgba = parseColorToRgba(resolvedDotColor);
        const markerRgba = parseColorToRgba(resolvedMarkerColor);
        const graticuleRgba = parseColorToRgba(resolvedGraticuleColor);
        const fillRgba = parseColorToRgba(resolvedFillColor);
        void markerRgba;

        const oceanGeometry = new SphereGeometry(globeRadius, 64, 64);
        const oceanColorObj = resolvedOceanColor && resolvedOceanColor !== "transparent"
            ? rgbaToColor(oceanRgba)
            : new Color(0, 0, 0);
        const oceanMaterial = new MeshBasicMaterial({
            color: oceanColorObj,
            transparent: oceanRgba.a < 1 || oceanRgba.a === 0,
            opacity: oceanRgba.a,
        });
        const oceanMesh = new Mesh(oceanGeometry, oceanMaterial);
        scene.add(oceanMesh);

        let globeOutlineMesh: Mesh | null = null;
        if (showOutline && outlineColor && outlineRgba.a > 0) {
            const outlinePositions: number[] = [];
            const segments = 128;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = Math.cos(angle) * globeRadius;
                const y = Math.sin(angle) * globeRadius;
                const z = 0;
                outlinePositions.push(x, y, z);
            }
            const outlinePoints: Vector3[] = [];
            for (let i = 0; i < outlinePositions.length; i += 3) {
                outlinePoints.push(
                    new Vector3(
                        outlinePositions[i],
                        outlinePositions[i + 1],
                        outlinePositions[i + 2]
                    )
                );
            }
            if (outlinePoints.length >= 2) {
                outlinePoints.push(outlinePoints[0].clone());
                const outlineColorObj = rgbaToColor(outlineRgba);
                const outlineMaterial = new MeshBasicMaterial({
                    color: outlineColorObj,
                    transparent: outlineRgba.a < 1,
                    opacity: outlineRgba.a,
                });
                const curve = new CatmullRomCurve3(outlinePoints);
                const radius = (outlineWidth / 10) * 0.01;
                const tubeGeometry = new TubeGeometry(
                    curve,
                    outlinePoints.length * 2,
                    radius,
                    8,
                    false
                );
                globeOutlineMesh = new Mesh(tubeGeometry, outlineMaterial);
            }
        }
        void globeOutlineMesh;

        const continentOutlineGroup = new Group();

        const graticuleGroup = new Group();
        if (showGrid && resolvedGraticuleColor && graticuleRgba.a > 0) {
            const graticuleColorObj = rgbaToColor(graticuleRgba);
            const graticuleMaterial = new MeshBasicMaterial({
                color: graticuleColorObj,
                transparent: graticuleRgba.a < 1 || graticuleRgba.a === 0,
                opacity: graticuleRgba.a,
            });
            const gridSpacing = 15;
            for (let lat = -90; lat <= 90; lat += gridSpacing) {
                const positions: number[] = [];
                const segments = 64;
                for (let i = 0; i <= segments; i++) {
                    const lng = (i / segments) * 360 - 180;
                    const pos = latLngToPosition(lat, lng);
                    positions.push(
                        pos.x * globeRadius,
                        pos.y * globeRadius,
                        pos.z * globeRadius
                    );
                }
                if (positions && positions.length >= 6) {
                    const points: Vector3[] = [];
                    for (let i = 0; i < positions.length; i += 3) {
                        points.push(
                            new Vector3(
                                positions[i],
                                positions[i + 1],
                                positions[i + 2]
                            )
                        );
                    }
                    if (points.length >= 2) {
                        const curve = new CatmullRomCurve3(points);
                        const radius = (gridWidth / 10) * 0.01;
                        const tubeGeometry = new TubeGeometry(
                            curve,
                            points.length * 2,
                            radius,
                            8,
                            false
                        );
                        const tubeMesh = new Mesh(
                            tubeGeometry,
                            graticuleMaterial
                        );
                        tubeMesh.renderOrder = 0;
                        graticuleGroup.add(tubeMesh);
                    }
                }
            }
            for (let lng = -180; lng < 180; lng += gridSpacing) {
                const positions: number[] = [];
                const segments = 64;
                for (let i = 0; i <= segments; i++) {
                    const lat = (i / segments) * 180 - 90;
                    const pos = latLngToPosition(lat, lng);
                    positions.push(
                        pos.x * globeRadius,
                        pos.y * globeRadius,
                        pos.z * globeRadius
                    );
                }
                if (positions && positions.length >= 6) {
                    const points: Vector3[] = [];
                    for (let i = 0; i < positions.length; i += 3) {
                        points.push(
                            new Vector3(
                                positions[i],
                                positions[i + 1],
                                positions[i + 2]
                            )
                        );
                    }
                    if (points.length >= 2) {
                        const curve = new CatmullRomCurve3(points);
                        const radius = (gridWidth / 10) * 0.01;
                        const tubeGeometry = new TubeGeometry(
                            curve,
                            points.length * 2,
                            radius,
                            8,
                            false
                        );
                        const tubeMesh = new Mesh(
                            tubeGeometry,
                            graticuleMaterial
                        );
                        tubeMesh.renderOrder = 0;
                        graticuleGroup.add(tubeMesh);
                    }
                }
            }
        }

        let dotInstances: InstancedMesh | Mesh | null = null;
        let markerMeshes: Mesh[] = [];

        const loadWorldData = async () => {
            const tStart = performance.now();
            try {
                setIsLoading(true);
                const landFeatures = await getLandFeatures();

                while (continentOutlineGroup.children.length > 0) {
                    continentOutlineGroup.remove(
                        continentOutlineGroup.children[0]
                    );
                }
                if (showOutline && outlineColor && outlineRgba.a > 0) {
                    const outlineColorObj = rgbaToColor(outlineRgba);
                    const outlineMaterial = new MeshBasicMaterial({
                        color: outlineColorObj,
                        transparent: outlineRgba.a < 1,
                        opacity: outlineRgba.a,
                        depthTest: true,
                        depthWrite: true,
                    });
                    const projection = geoEquirectangular();
                    const pathGenerator = geoPath().projection(projection);
                    let processedCount = 0;
                    let skippedCount = 0;
                    landFeatures.features.forEach((feature: any) => {
                        const featureType =
                            feature.properties?.featurecla ||
                            feature.properties?.type ||
                            "";
                        const featureName = feature.properties?.name || "";
                        if (
                            featureType.toLowerCase().includes("graticule") ||
                            featureType.toLowerCase().includes("grid") ||
                            featureType.toLowerCase().includes("line") ||
                            featureName.toLowerCase().includes("graticule") ||
                            featureName.toLowerCase().includes("grid") ||
                            featureName.toLowerCase().includes("line")
                        ) {
                            skippedCount++;
                            return;
                        }
                        processedCount++;
                        const pathString = pathGenerator(feature);
                        if (!pathString) return;
                        const commands = pathString.match(/[ML][^MLZ]*/g) || [];
                        if (commands.length === 0) return;

                        const geometry = feature.geometry;
                        if (!geometry || !geometry.coordinates) return;

                        const processRing = (ring: number[][]) => {
                            if (ring.length < 2) return;
                            const simplifiedRing = simplifyRing(ring, detail);
                            const positions: number[] = [];
                            simplifiedRing.forEach((coord) => {
                                const [lng, lat] = coord;
                                const pos = latLngToPosition(lat, lng);
                                positions.push(
                                    pos.x * globeRadius,
                                    pos.y * globeRadius,
                                    pos.z * globeRadius
                                );
                            });
                            if (positions && positions.length >= 6) {
                                const points: Vector3[] = [];
                                for (let i = 0; i < positions.length; i += 3) {
                                    points.push(
                                        new Vector3(
                                            positions[i],
                                            positions[i + 1],
                                            positions[i + 2]
                                        )
                                    );
                                }
                                if (
                                    points.length > 0 &&
                                    points[0].distanceTo(
                                        points[points.length - 1]
                                    ) > 0.001
                                ) {
                                    points.push(points[0].clone());
                                }
                                if (points.length >= 2) {
                                    const curve = new CatmullRomCurve3(points);
                                    const radius = (outlineWidth / 10) * 0.01;
                                    const tubeGeometry = new TubeGeometry(
                                        curve,
                                        points.length * 2,
                                        radius,
                                        8,
                                        false
                                    );
                                    const tubeMesh = new Mesh(
                                        tubeGeometry,
                                        outlineMaterial
                                    );
                                    tubeMesh.renderOrder = 0;
                                    continentOutlineGroup.add(tubeMesh);
                                }
                            }
                        };
                        if (
                            geometry.type === "Polygon" &&
                            geometry.coordinates.length > 0
                        ) {
                            processRing(geometry.coordinates[0]);
                        } else if (geometry.type === "MultiPolygon") {
                            geometry.coordinates.forEach((polygon: any) => {
                                if (polygon.length > 0) {
                                    processRing(polygon[0]);
                                }
                            });
                        }
                    });
                }

                // Amostragem proporcional ao tamanho real do elemento (64-80px), reduzindo 97% dos pixels
                const bitmapWidth = 360;
                const bitmapHeight = 180;
                const offscreenCanvas = document.createElement("canvas");
                offscreenCanvas.width = bitmapWidth;
                offscreenCanvas.height = bitmapHeight;
                const ctx = offscreenCanvas.getContext("2d", {
                    willReadFrequently: true,
                });
                if (!ctx) throw new Error("Canvas not supported");
                const projection = geoEquirectangular().fitSize(
                    [bitmapWidth, bitmapHeight],
                    { type: "Sphere" } as any
                );
                const pathGenerator = geoPath()
                    .projection(projection)
                    .context(ctx);
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, bitmapWidth, bitmapHeight);
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                landFeatures.features.forEach((feature: any) => {
                    pathGenerator(feature);
                });
                ctx.fill();
                const imageData = ctx.getImageData(
                    0,
                    0,
                    bitmapWidth,
                    bitmapHeight
                );
                const pixels = imageData.data;
                const isOnLand = (lng: number, lat: number) => {
                    const x =
                        Math.round(((lng + 180) / 360) * bitmapWidth) %
                        bitmapWidth;
                    const y = Math.round(((90 - lat) / 180) * bitmapHeight);
                    const clampedY = Math.max(0, Math.min(bitmapHeight - 1, y));
                    const idx = (clampedY * bitmapWidth + x) * 4;
                    return pixels[idx] > 128;
                };

                if (fill === "solid") {
                    const texW = 360;
                    const texH = 180;
                    const fillCanvas = document.createElement("canvas");
                    fillCanvas.width = texW;
                    fillCanvas.height = texH;
                    const fctx = fillCanvas.getContext("2d")!;
                    const img = fctx.createImageData(texW, texH);
                    const data = img.data;
                    const fr = Math.round(fillRgba.r * 255);
                    const fg = Math.round(fillRgba.g * 255);
                    const fb = Math.round(fillRgba.b * 255);
                    const fa = Math.round((fillRgba.a || 1) * 255);
                    for (let ty = 0; ty < texH; ty++) {
                        for (let tx = 0; tx < texW; tx++) {
                            const u = tx / texW;
                            const v = ty / texH;
                            let lng = (u - 0.25) * 360;
                            lng = ((((lng + 180) % 360) + 360) % 360) - 180;
                            const lat = (v - 0.5) * 180;
                            const onLand = allDots || isOnLand(lng, lat);
                            const idx = (ty * texW + tx) * 4;
                            if (onLand) {
                                data[idx] = fr;
                                data[idx + 1] = fg;
                                data[idx + 2] = fb;
                                data[idx + 3] = fa;
                            } else {
                                data[idx + 3] = 0;
                            }
                        }
                    }
                    fctx.putImageData(img, 0, 0);
                    const fillTexture = new CanvasTexture(fillCanvas);
                    fillTexture.flipY = false;
                    fillTexture.needsUpdate = true;
                    const fillGeometry = new SphereGeometry(
                        globeRadius * 1.002,
                        64,
                        64
                    );
                    const fillMaterial = new MeshBasicMaterial({
                        map: fillTexture,
                        transparent: true,
                    });
                    dotInstances = new Mesh(fillGeometry, fillMaterial);
                    globeGroup.add(dotInstances);
                } else {
                    const dotCoordinates: number[][] = [];
                    const baseStep = dotSpacing * 0.08;
                    for (let lat = -90; lat <= 90; lat += baseStep) {
                        const latRad = (Math.abs(lat) * Math.PI) / 180;
                        const cosLat = Math.cos(latRad);
                        const lngStep =
                            cosLat > 0.01
                                ? baseStep / Math.max(0.3, cosLat)
                                : 360;
                        for (let lng = -180; lng < 180; lng += lngStep) {
                            if (allDots || isOnLand(lng, lat)) {
                                dotCoordinates.push([lng, lat]);
                            }
                        }
                    }

                    if (dotCoordinates.length > 0) {
                        const dotGeometry = new SphereGeometry(
                            0.01 * dotSizeMultiplier,
                            4,
                            4
                        );
                        const dotColorObj = rgbaToColor(dotRgba);
                        const dotMaterial = new MeshBasicMaterial({
                            color: dotColorObj,
                            transparent: dotRgba.a < 1 || dotRgba.a === 0,
                            opacity: dotRgba.a,
                        });
                        const instanced = new InstancedMesh(
                            dotGeometry,
                            dotMaterial,
                            dotCoordinates.length
                        );
                        const matrix = new Matrix4();
                        for (let i = 0; i < dotCoordinates.length; i++) {
                            const [lng, lat] = dotCoordinates[i];
                            const pos = latLngToPosition(lat, lng);
                            matrix.makeScale(1, 1, 1);
                            matrix.setPosition(
                                pos.x * globeRadius,
                                pos.y * globeRadius,
                                pos.z * globeRadius
                            );
                            instanced.setMatrixAt(i, matrix);
                        }
                        instanced.instanceMatrix.needsUpdate = true;
                        dotInstances = instanced;
                        globeGroup.add(dotInstances);
                    }
                }

                updateMarkers();
                renderer.render(scene, camera);
                canvas.style.opacity = "1";
                canvas.style.visibility = "visible";
                setIsLoading(false);
                const tElapsed = performance.now() - tStart;
                if (typeof console !== "undefined" && console.debug) {
                    console.debug(`[Globe 3D] Inicialização e amostragem concluídas em ${tElapsed.toFixed(1)}ms`);
                }
            } catch (err) {
                setError("Failed to load land map data");
                setIsLoading(false);
            }
        };

        const updateMarkers = () => {
            markerMeshes.forEach((mesh) => globeGroup.remove(mesh));
            markerMeshes = [];
            if (markerConfig.markers && markerConfig.markers.length > 0) {
                const markerSize = 0.01 * markerRadiusMultiplier;
                const markerGeometry = new SphereGeometry(markerSize, 16, 16);
                const markerColorObj = rgbaToColor(markerRgba);
                const markerMaterial = new MeshBasicMaterial({
                    color: markerColorObj,
                    transparent: markerRgba.a < 1,
                    opacity: markerRgba.a,
                });
                markerConfig.markers.forEach((marker) => {
                    if (
                        !marker ||
                        typeof marker.lat !== "number" ||
                        typeof marker.lng !== "number"
                    )
                        return;
                    const pos = latLngToPosition(marker.lat, marker.lng);
                    const markerMesh = new Mesh(
                        markerGeometry,
                        markerMaterial.clone()
                    );
                    markerMesh.position.set(
                        pos.x * globeRadius,
                        pos.y * globeRadius,
                        pos.z * globeRadius
                    );
                    globeGroup.add(markerMesh);
                    markerMeshes.push(markerMesh);
                });
            }
        };

        const initialLongitudeRad = (initialLongitude * Math.PI) / 180;
        const initialLatitudeRad = (initialLatitude * Math.PI) / 180;
        const rotation = { x: initialLongitudeRad, y: initialLatitudeRad };
        const targetRotation = {
            x: initialLongitudeRad,
            y: initialLatitudeRad,
        };
        const velocity = { x: 0, y: 0 };
        let isDragging = false;
        let isHovering = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let animationFrameId: number | null = null;
        const lerpFactor =
            smoothingN === 0 ? 1 : mapLinear(smoothingN, 0, 1, 0.4, 0.03);
        const velocityDecay = mapLinear(smoothingN, 0, 1, 0.7, 0.96);

        const globeGroup = new Group();
        globeGroup.rotation.y = initialLongitudeRad;
        globeGroup.rotation.x = initialLatitudeRad;
        scene.add(globeGroup);
        globeGroup.add(oceanMesh);
        if (showGrid && graticuleColor && graticuleRgba.a > 0) {
            globeGroup.add(graticuleGroup);
        }
        globeGroup.add(continentOutlineGroup);
        markerMeshes.forEach((mesh) => globeGroup.add(mesh));

        let isVisible = true;
        let isPageVisible = typeof document !== "undefined" ? !document.hidden : true;

        const animate = () => {
            if (!isVisible || !isPageVisible) {
                animationFrameId = null;
                return;
            }

            let needsRender = false;
            const threshold = 0.01;
            if (
                !isDragging &&
                rotationSpeed !== 0 &&
                (!stopOnHover || !isHovering)
            ) {
                targetRotation.x += rotationSpeed * 0.01;
            }
            if (!isDragging && smoothingN > 0) {
                if (
                    Math.abs(velocity.x) > threshold ||
                    Math.abs(velocity.y) > threshold
                ) {
                    targetRotation.x += velocity.x;
                    targetRotation.y += velocity.y;
                    targetRotation.y = Math.max(
                        -Math.PI / 2,
                        Math.min(Math.PI / 2, targetRotation.y)
                    );
                    velocity.x *= velocityDecay;
                    velocity.y *= velocityDecay;
                } else {
                    velocity.x = 0;
                    velocity.y = 0;
                }
            }
            const dx = targetRotation.x - rotation.x;
            const dy = targetRotation.y - rotation.y;
            if (
                Math.abs(dx) > threshold ||
                Math.abs(dy) > threshold ||
                rotationSpeed !== 0 ||
                isDragging
            ) {
                rotation.x += dx * lerpFactor;
                rotation.y += dy * lerpFactor;
                rotation.y = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, rotation.y)
                );
                needsRender = true;
            }
            if (needsRender || rotationSpeed !== 0 || isDragging) {
                globeGroup.rotation.y = rotation.x;
                globeGroup.rotation.x = rotation.y;
                renderer.render(scene, camera);
            }
            const hasVelocity =
                Math.abs(velocity.x) > threshold ||
                Math.abs(velocity.y) > threshold;
            const hasLerpDelta =
                Math.abs(dx) > threshold || Math.abs(dy) > threshold;
            const needsContinue =
                isDragging || rotationSpeed !== 0 || hasVelocity || hasLerpDelta;
            if (needsContinue) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                animationFrameId = null;
            }
        };

        const startAnimation = () => {
            if (animationFrameId === null && isVisible && isPageVisible) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };
        if (rotationSpeed !== 0) {
            startAnimation();
        }

        // Pausa renderização quando aba não estiver visível
        const handleVisibilityChange = () => {
            isPageVisible = !document.hidden;
            if (isPageVisible && isVisible) {
                startAnimation();
            } else if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Pausa renderização quando o elemento estiver fora do viewport
        const intersectionObserver = new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
            if (isVisible && isPageVisible) {
                startAnimation();
            } else if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }, { threshold: 0.05 });
        intersectionObserver.observe(container);

        const handleMouseDown = (event: MouseEvent) => {
            isDragging = true;
            velocity.x = 0;
            velocity.y = 0;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            startAnimation();
            const handleMouseMoveDrag = (moveEvent: MouseEvent) => {
                const sensitivity = mapDragSpeedUiToSensitivity(dragSpeed);
                const dx = moveEvent.clientX - lastMouseX;
                const dy = moveEvent.clientY - lastMouseY;
                targetRotation.x += dx * sensitivity;
                targetRotation.y += dy * sensitivity;
                targetRotation.y = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, targetRotation.y)
                );
                velocity.x = dx * sensitivity * 0.3;
                velocity.y = dy * sensitivity * 0.3;
                lastMouseX = moveEvent.clientX;
                lastMouseY = moveEvent.clientY;
            };
            const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMoveDrag);
                document.removeEventListener("mouseup", handleMouseUp);
                isDragging = false;
            };
            document.addEventListener("mousemove", handleMouseMoveDrag);
            document.addEventListener("mouseup", handleMouseUp);
        };
        canvas.addEventListener("mousedown", handleMouseDown);

        const raycaster = new Raycaster();
        const mouse = new Vector2();
        const handleMouseMove = (event: MouseEvent) => {
            if (!stopOnHover) return;
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(oceanMesh);
            isHovering = intersects.length > 0;
        };
        canvas.addEventListener("mousemove", handleMouseMove);

        const resizeObserver = new ResizeObserver(() => {
            const newWidth =
                container.clientWidth || container.offsetWidth || 100;
            const newHeight =
                container.clientHeight || container.offsetHeight || 100;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
            const newCameraDistance = 2.5 / scaleMultiplier;
            camera.position.set(0, 0, newCameraDistance);
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        });
        resizeObserver.observe(container);

        loadWorldData();

        return () => {
            if (animationFrameId !== null)
                cancelAnimationFrame(animationFrameId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            intersectionObserver.disconnect();
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            resizeObserver.disconnect();

            // Liberação (dispose) completa de geometrias, materiais e texturas
            scene.traverse((obj: any) => {
                if (obj.geometry) {
                    obj.geometry.dispose();
                }
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m: any) => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (obj.material.map) obj.material.map.dispose();
                        obj.material.dispose();
                    }
                }
            });

            renderer.dispose();
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        };
    }, [
        speed,
        smoothing,
        fill,
        fillColor,
        allDots,
        density,
        dotSize,
        dotColor,
        scale,
        stopOnHover,
        direction,
        initialLatitude,
        initialLongitude,
        oceanColor,
        outlineColor,
        showOutline,
        graticuleColor,
        showGrid,
        outlineWidth,
        dragSpeed,
        detail,
        markerColor,
        markerSize,
        markerCount,
    ]);

    const containerStyle: CSSProperties = {
        ...style,
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    };

    if (prefersReducedMotion) {
        return (
            <div className={className} style={containerStyle} aria-label="Globo terrestre estático">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm" fill="none">
                    <circle cx="50" cy="50" r="46" stroke={outlineColor || "#007AFF"} strokeWidth="2" opacity="0.6" />
                    <ellipse cx="50" cy="50" rx="46" ry="18" stroke={graticuleColor || "rgba(0,122,255,0.2)"} strokeWidth="1" />
                    <ellipse cx="50" cy="50" rx="18" ry="46" stroke={graticuleColor || "rgba(0,122,255,0.2)"} strokeWidth="1" />
                    <line x1="4" y1="50" x2="96" y2="50" stroke={graticuleColor || "rgba(0,122,255,0.2)"} strokeWidth="1" />
                    <line x1="50" y1="4" x2="50" y2="96" stroke={graticuleColor || "rgba(0,122,255,0.2)"} strokeWidth="1" />
                    <circle cx="50" cy="50" r="5" fill={dotColor || "#007AFF"} />
                </svg>
            </div>
        );
    }

    if (error) {
        return (
            <div className={className} style={containerStyle}>
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        minWidth: 0,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        textAlign: "center",
                        padding: "8px",
                    }}
                >
                    <div style={{ fontSize: "11px", opacity: 0.6 }}>
                        🌐
                    </div>
                </div>
            </div>
        );
    }

    return <div ref={containerRef} className={className} style={containerStyle} />;
}
