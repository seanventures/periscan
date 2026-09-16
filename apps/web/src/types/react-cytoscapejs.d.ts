declare module "react-cytoscapejs" {
  import type { CSSProperties, ComponentType } from "react";
  import type {
    Core,
    ElementDefinition,
    LayoutOptions,
    StylesheetJson
  } from "cytoscape";

  export interface CytoscapeComponentProps {
    id?: string;
    className?: string;
    style?: CSSProperties;
    elements: ElementDefinition[];
    layout?: LayoutOptions;
    stylesheet?: StylesheetJson;
    cy?: (cy: Core) => void;
    minZoom?: number;
    maxZoom?: number;
    zoom?: number;
    pan?: { x: number; y: number };
    userZoomingEnabled?: boolean;
    userPanningEnabled?: boolean;
    boxSelectionEnabled?: boolean;
    autoungrabify?: boolean;
    wheelSensitivity?: number;
  }

  const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}
