import React from 'react';
import { Composition } from 'remotion';
import { TitleScene } from './compositions/TitleScene';
import { NarrationScene } from './compositions/NarrationScene';
import { ImageScene } from './compositions/ImageScene';
import { SideBySideScene } from './compositions/SideBySideScene';
import { TableScene } from './compositions/TableScene';

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TitleScene"
        component={TitleScene}
        durationInFrames={150}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Paper Title',
          authors: 'Author Names',
          subtitle: '',
        }}
      />
      <Composition
        id="NarrationScene"
        component={NarrationScene}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Section Title',
          content: 'Section content text...',
          audioUrl: '',
        }}
      />
      <Composition
        id="ImageScene"
        component={ImageScene}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Figure 1',
          imageUrl: '',
          caption: '',
          audioUrl: '',
        }}
      />
      <Composition
        id="SideBySideScene"
        component={SideBySideScene}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Analysis',
          imageUrl: '',
          content: '',
          audioUrl: '',
        }}
      />
      <Composition
        id="TableScene"
        component={TableScene}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Results',
          headers: [] as string[],
          rows: [] as string[][],
          audioUrl: '',
        }}
      />
    </>
  );
};
