import type { Types } from '@cornerstonejs/core';
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
} from '@cornerstonejs/core';
import * as cornerstone from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  addButtonToToolbar,
} from '../../../../utils/demo/helpers';
import { fillVolumeLabelmapWithMockData } from '../../../../utils/test/testUtils';
import * as cornerstoneTools from '@cornerstonejs/tools';

// This is for debugging purposes
console.warn(
  'Click on index.ts to open source code for this example --------->'
);

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  segmentation,
} = cornerstoneTools;

const { ViewportType } = Enums;

// Define a unique id for the volume
const volumeName = 'CT_VOLUME_ID'; // Id of the volume less loader prefix
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume'; // Loader id which defines which volume loader to use
const volumeId = `${volumeLoaderScheme}:${volumeName}`; // VolumeId with loader id + volume id
const segmentationId1 = 'SEGMENTATION_ID_1';
const toolGroupId1 = 'MY_TOOL_GROUP_ID_1';
const toolGroupId2 = 'MY_TOOL_GROUP_ID_2';
const renderingEngineId = 'myRenderingEngine';
const viewportId1 = 'CT_AXIAL_STACK';
const viewportId2 = 'CT_AXIAL_STACK_2';

// ======== Set up page ======== //
setTitleAndDescription(
  'Labelmap Segment Color Change',
  'Here we demonstrate how to change the color of a segment in a segmentation representation'
);

const size = '500px';
const content = document.getElementById('content');
const viewportGrid = document.createElement('div');

viewportGrid.style.display = 'flex';
viewportGrid.style.display = 'flex';
viewportGrid.style.flexDirection = 'row';

const element1 = document.createElement('div');
const element2 = document.createElement('div');
element1.style.width = size;
element1.style.height = size;
element2.style.width = size;
element2.style.height = size;

viewportGrid.appendChild(element1);
viewportGrid.appendChild(element2);

content.appendChild(viewportGrid);

const instructions = document.createElement('p');
instructions.innerText = `
  In this example we demonstrate how to change a color for each
  segmentation representation in two different viewports. Notice that
  here we are depicting the same segmentation in two different viewports
  on two different viewports. This is to demonstrate that the color
  change is specific to the viewport and viewport.
`;

let segRep1;
let segRep2;

// ============================= //

const getRandomRGBA = () => [
  Math.floor(Math.random() * 255),
  Math.floor(Math.random() * 255),
  Math.floor(Math.random() * 255),
  255,
];

addButtonToToolbar({
  title: 'change segment 1 color left viewport',
  onClick: () => {
    segmentation.config.color.setSegmentIndexColor(
      viewportId1,
      segmentationId1,
      1,
      getRandomRGBA()
    );
  },
});

addButtonToToolbar({
  title: 'change segment 2 color right viewport',
  onClick: () => {
    segmentation.config.color.setSegmentIndexColor(
      viewportId2,
      segmentationId1,
      2,
      getRandomRGBA()
    );
  },
});

// ============================= //

async function addSegmentationsToState() {
  // Create a segmentation of the same resolution as the source data

  volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
    volumeId: segmentationId1,
  });

  // Add the segmentations to state
  segmentation.addSegmentations([
    {
      segmentationId: segmentationId1,
      representation: {
        // The type of segmentation
        type: csToolsEnums.SegmentationRepresentations.Labelmap,
        // The actual segmentation data, in the case of labelmap this is a
        // reference to the source volume of the segmentation.
        data: {
          volumeId: segmentationId1,
        },
      },
    },
  ]);

  // Add some data to the segmentations
  fillVolumeLabelmapWithMockData({
    volumeId: segmentationId1,
    cornerstone,
  });
}

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  // Add tools to Cornerstone3D

  // Define tool groups to add the segmentation display tool to
  const toolGroup1 = ToolGroupManager.createToolGroup(toolGroupId1);
  const toolGroup2 = ToolGroupManager.createToolGroup(toolGroupId2);

  // Get Cornerstone imageIds for the source data and fetch metadata into RAM
  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
    SeriesInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
    wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
  });

  const smallVolumeImageIds = [imageIds[0], imageIds[1]];

  // Define a volume in memory
  const volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds: smallVolumeImageIds,
  });

  // Add some segmentations based on the source data volume
  await addSegmentationsToState();

  // Instantiate a rendering engine
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Create the viewports
  const viewportInputArray = [
    {
      viewportId: viewportId1,
      type: ViewportType.ORTHOGRAPHIC,
      element: element1,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
    {
      viewportId: viewportId2,
      type: ViewportType.ORTHOGRAPHIC,
      element: element2,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
  ];

  toolGroup1.addViewport(viewportId1, renderingEngineId);
  toolGroup2.addViewport(viewportId2, renderingEngineId);

  renderingEngine.setViewports(viewportInputArray);

  // Set the volume to load
  volume.load();

  // Set volumes on the viewports
  await setVolumesForViewports(
    renderingEngine,
    [{ volumeId }],
    [viewportId1, viewportId2]
  );

  // // Add the segmentation representations to toolgroup1
  await segmentation.addSegmentationRepresentations(viewportId1, [
    {
      segmentationId: segmentationId1,
      type: csToolsEnums.SegmentationRepresentations.Labelmap,
      config: {
        colorLUTOrIndex: [
          [0, 0, 0, 0],
          [0, 0, 255, 255],
          [255, 255, 0, 255],
        ],
      },
    },
  ]);

  await segmentation.addSegmentationRepresentations(viewportId2, [
    {
      segmentationId: segmentationId1,
      type: csToolsEnums.SegmentationRepresentations.Labelmap,
    },
  ]);

  // Render the image
  renderingEngine.renderViewports([viewportId1, viewportId2]);
}

run();
