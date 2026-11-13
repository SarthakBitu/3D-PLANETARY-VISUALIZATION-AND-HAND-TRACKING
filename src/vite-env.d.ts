/// <reference types="vite/client" />

declare module 'world-atlas/countries-50m.json' {
  const topology: {
    type: 'Topology';
    objects: {
      countries: {
        type: 'GeometryCollection';
        geometries: Array<{
          type: string;
          id?: string;
          properties?: { name?: string };
          arcs: unknown;
        }>;
      };
      land: {
        type: string;
        geometries?: unknown[];
        arcs?: unknown;
      };
    };
    arcs: number[][][];
    transform?: {
      scale: [number, number];
      translate: [number, number];
    };
  };
  export default topology;
}
