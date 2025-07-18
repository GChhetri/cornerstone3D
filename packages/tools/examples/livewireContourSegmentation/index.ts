import type { Types } from '@cornerstonejs/core';
import { RenderingEngine, Enums, volumeLoader } from '@cornerstonejs/core';
import {
  initDemo,
  addButtonToToolbar,
  addSliderToToolbar,
  addDropdownToToolbar,
  addToggleButtonToToolbar,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  createInfoSection,
  setCtTransferFunctionForVolumeActor,
  addManipulationBindings,
} from '../../../../utils/demo/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';
import type { Types as cstTypes } from '@cornerstonejs/tools';

// This is for debugging purposes
console.warn(
  'Click on index.ts to open source code for this example --------->'
);

const DEFAULT_SEGMENTATION_CONFIG = {
  fillAlpha: 0.5,
  fillAlphaInactive: 0.3,
  outlineOpacity: 1,
  outlineOpacityInactive: 0.85,
  outlineWidth: 3,
  outlineWidthInactive: 2,
  outlineDash: undefined,
  outlineDashInactive: undefined,
};

const { KeyboardBindings } = cornerstoneTools.Enums;

const {
  PlanarFreehandContourSegmentationTool,
  LivewireContourSegmentationTool,
  ToolGroupManager,
  Enums: csToolsEnums,
  segmentation,
} = cornerstoneTools;

const { ViewportType } = Enums;
const { MouseBindings } = csToolsEnums;
const renderingEngineId = 'myRenderingEngine';
const stackViewportId = 'CT_STACK';
const volumeCoronalViewportId = 'CT_CORONAL';
const volumeSagittalViewportId = 'CT_SAGITTAL';

const viewportIds = [
  stackViewportId,
  volumeCoronalViewportId,
  volumeSagittalViewportId,
];

const segmentationId = `SEGMENTATION_ID`;
const segmentIndexes = [1, 2, 3, 4, 5];
const segmentVisibilityMap = new Map();
let activeSegmentIndex = 0;

// ======== Set up page ======== //

setTitleAndDescription(
  'Livewire Segmentation Tool',
  'Interactive segmentation with intelligent scissors that uses Laplacian of Gaussian filter to find the shortest-path'
);

const content = document.getElementById('content');
const viewportsContainer = document.createElement('div');

Object.assign(viewportsContainer.style, {
  display: 'grid',
  height: '500px',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '5px',
});

content.appendChild(viewportsContainer);
let viewportId;
const createViewportElement = (id: string) => {
  const element = document.createElement('div');

  // Disable right click context menu so we can have right click tools
  element.oncontextmenu = (e) => e.preventDefault();

  element.id = id;
  viewportsContainer.appendChild(element);

  return element;
};

const stackViewportElement = createViewportElement('axial-element');
const volumeCoronalViewportElement = createViewportElement('coronal-element');
const volumeSagittalViewportElement = createViewportElement('sagittal-element');

createInfoSection(content)
  .addInstruction(
    'Viewports: Axial (Stack), Coronal (Volume), Sagittal (Volume)'
  )
  .addInstruction('Left click to use the livewire tool')
  .addInstruction('Middle click to use the pan tool')
  .addInstruction('Right click to use the zoom tool')
  .addInstruction('Press "escape" to cancel drawing');

// ==[ Toolbar ]================================================================

addDropdownToToolbar({
  labelText: 'Segment Index',
  options: { values: segmentIndexes, defaultValue: segmentIndexes[0] },
  onSelectedValueChange: (nameAsStringOrNumber) => {
    updateActiveSegmentIndex(Number(nameAsStringOrNumber));
  },
});

addToggleButtonToToolbar({
  title: 'Show/Hide All Segments',
  onClick: function (toggle) {
    const segmentsVisibility = getSegmentsVisibilityState();

    segmentation.config.visibility.setSegmentationRepresentationVisibility(
      viewportIds[0],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      !toggle
    );
    segmentation.config.visibility.setSegmentationRepresentationVisibility(
      viewportIds[1],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      !toggle
    );
    segmentation.config.visibility.setSegmentationRepresentationVisibility(
      viewportIds[2],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      !toggle
    );

    segmentsVisibility.fill(!toggle);
  },
});

addButtonToToolbar({
  title: 'Show/Hide Current Segment',
  onClick: function () {
    const segmentsVisibility = getSegmentsVisibilityState();
    const visible = !segmentsVisibility[activeSegmentIndex];

    segmentation.config.visibility.setSegmentIndexVisibility(
      viewportIds[0],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      activeSegmentIndex,
      visible
    );
    segmentation.config.visibility.setSegmentIndexVisibility(
      viewportIds[1],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      activeSegmentIndex,
      visible
    );
    segmentation.config.visibility.setSegmentIndexVisibility(
      viewportIds[2],
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
      activeSegmentIndex,
      visible
    );

    segmentsVisibility[activeSegmentIndex] = visible;
  },
});

addSliderToToolbar({
  id: 'outlineWidth',
  title: 'Outline Thickness',
  range: [0.1, 10],
  step: 0.1,
  defaultValue: 1,
  onSelectedValueChange: (value) => {
    updateSegmentationConfig({ outlineWidth: Number(value) });
  },
});

addSliderToToolbar({
  id: 'outlineOpacity',
  title: 'Outline Opacity',
  range: [0, 1],
  step: 0.05,
  defaultValue: 1,
  onSelectedValueChange: (value) => {
    updateSegmentationConfig({ outlineOpacity: Number(value) });
  },
});

addSliderToToolbar({
  id: 'fillAlpha',
  title: 'Fill Alpha',
  range: [0, 1],
  step: 0.05,
  defaultValue: 0.5,
  onSelectedValueChange: (value) => {
    updateSegmentationConfig({ fillAlpha: Number(value) });
  },
});

addSliderToToolbar({
  id: 'outlineDash',
  title: 'Outline Dash',
  range: [0, 10],
  step: 1,
  defaultValue: 0,
  onSelectedValueChange: (value) => {
    const outlineDash = value === '0' ? undefined : `${value},${value}`;
    updateSegmentationConfig({ outlineDash: outlineDash });
  },
});

// =============================================================================

const toolGroupId = 'DEFAULT_TOOL_GROUP_ID';

function updateActiveSegmentIndex(segmentIndex: number): void {
  activeSegmentIndex = segmentIndex;
  segmentation.segmentIndex.setActiveSegmentIndex(segmentationId, segmentIndex);
}

function getSegmentsVisibilityState() {
  let segmentsVisibility = segmentVisibilityMap.get(segmentationId);

  if (!segmentsVisibility) {
    segmentsVisibility = new Array(segmentIndexes.length + 1).fill(true);
    segmentVisibilityMap.set(segmentationId, segmentsVisibility);
  }

  return segmentsVisibility;
}

function updateSegmentationConfig(config) {
  const style = segmentation.config.style.getStyle({
    segmentationId,
    type: csToolsEnums.SegmentationRepresentations.Contour,
  });

  const mergedConfig = { ...style, ...config };

  segmentation.config.style.setStyle(
    {
      segmentationId,
      type: csToolsEnums.SegmentationRepresentations.Contour,
    },
    mergedConfig
  );
}

const cancelToolDrawing = (evt) => {
  const { element, key } = evt.detail;
  if (key === 'Escape') {
    cornerstoneTools.cancelActiveManipulations(element);
  }
};

stackViewportElement.addEventListener(csToolsEnums.Events.KEY_DOWN, (evt) => {
  cancelToolDrawing(evt);
});

volumeCoronalViewportElement.addEventListener(
  csToolsEnums.Events.KEY_DOWN,
  (evt) => {
    cancelToolDrawing(evt);
  }
);

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  // Add tools to Cornerstone3D
  cornerstoneTools.addTool(PlanarFreehandContourSegmentationTool);
  cornerstoneTools.addTool(LivewireContourSegmentationTool);

  // Define a tool group, which defines how mouse events map to tool commands for
  // Any viewport using the group
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

  // Add the tools to the tool group
  toolGroup.addTool(PlanarFreehandContourSegmentationTool.toolName);
  toolGroup.addTool(LivewireContourSegmentationTool.toolName);
  addManipulationBindings(toolGroup);

  // Set the initial state of the tools
  toolGroup.setToolPassive(PlanarFreehandContourSegmentationTool.toolName);

  toolGroup.setToolActive(LivewireContourSegmentationTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Left Click
      },
      {
        mouseButton: MouseBindings.Primary, // Left Click+Shift
        modifierKey: KeyboardBindings.Shift,
      },
    ],
  });

  // Get Cornerstone imageIds and fetch metadata into RAM
  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
    SeriesInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
    wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
  });

  // Instantiate a rendering engine
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Create a stack viewport
  const stackViewportInput = {
    viewportId: stackViewportId,
    type: ViewportType.STACK,
    element: stackViewportElement,
    defaultOptions: {
      background: <Types.Point3>[0.2, 0, 0.2],
    },
  };

  renderingEngine.enableElement(stackViewportInput);

  // Set the tool group on stack the viewport
  toolGroup.addViewport(stackViewportId, renderingEngineId);

  // Get the stack viewport that was created
  const stackViewport = <Types.IStackViewport>(
    renderingEngine.getViewport(stackViewportId)
  );

  // Define a stack containing a few images
  const stackImageIds = imageIds.slice(0, 5);

  // Set the stack on the viewport
  await stackViewport.setStack(stackImageIds);

  // Render the image
  stackViewport.render();

  // Define a unique id for the volume
  const volumeName = 'CT_VOLUME_ID'; // Id of the volume less loader prefix
  const volumeLoaderScheme = 'cornerstoneStreamingImageVolume'; // Loader id which defines which volume loader to use
  const volumeId = `${volumeLoaderScheme}:${volumeName}`; // VolumeId with loader id + volume id

  // Define a volume in memory
  const volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds,
  });

  // Set the volume to load
  volume.load();

  // Create a volume viewport (Coronal)
  const volumeCoronalViewportInput = {
    viewportId: volumeCoronalViewportId,
    type: ViewportType.ORTHOGRAPHIC,
    element: volumeCoronalViewportElement,
    defaultOptions: {
      orientation: Enums.OrientationAxis.CORONAL,
      background: <Types.Point3>[0.2, 0, 0.2],
    },
  };

  renderingEngine.enableElement(volumeCoronalViewportInput);

  // Set the tool group on stack the viewport
  toolGroup.addViewport(volumeCoronalViewportId, renderingEngineId);

  // Get the volume viewport that was created
  const volumeCoronalViewport = <Types.IVolumeViewport>(
    renderingEngine.getViewport(volumeCoronalViewportId)
  );

  // Set the volume on the viewport
  await volumeCoronalViewport.setVolumes([
    { volumeId, callback: setCtTransferFunctionForVolumeActor },
  ]);

  // Render the image
  volumeCoronalViewport.render();

  // Create a volume viewport (Coronal)
  const volumeSagittalViewportInput = {
    viewportId: volumeSagittalViewportId,
    type: ViewportType.ORTHOGRAPHIC,
    element: volumeSagittalViewportElement,
    defaultOptions: {
      orientation: Enums.OrientationAxis.SAGITTAL,
      background: <Types.Point3>[0.2, 0, 0.2],
    },
  };

  renderingEngine.enableElement(volumeSagittalViewportInput);

  // Set the tool group on stack the viewport
  toolGroup.addViewport(volumeSagittalViewportId, renderingEngineId);

  // Get the volume viewport that was created
  const volumeSagittalViewport = <Types.IVolumeViewport>(
    renderingEngine.getViewport(volumeSagittalViewportId)
  );

  // Set the volume on the viewport
  await volumeSagittalViewport.setVolumes([
    { volumeId, callback: setCtTransferFunctionForVolumeActor },
  ]);

  // Render the image
  volumeSagittalViewport.render();

  // Add a segmentation that will contains the contour annotations
  segmentation.addSegmentations([
    {
      segmentationId,
      representation: {
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
    },
  ]);

  // Create a segmentation representation associated to the viewportId
  viewportIds.map((viewportId) => {
    return segmentation.addSegmentationRepresentations(viewportId, [
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Contour,
      },
    ]);
  });

  updateActiveSegmentIndex(1);
}

run();
