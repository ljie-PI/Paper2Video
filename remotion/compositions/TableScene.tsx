// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Audio, staticFile } from 'remotion';

type Props = {
  title: string;
  headers: string[];
  rows: string[][];
  audioUrl?: string;
};

export const TableScene: React.FC<Props> = ({ title, headers, rows, audioUrl }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0a0b10 0%, #111225 100%)',
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {audioUrl && <Audio src={staticFile(audioUrl)} />}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 40,
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: 40,
        }}
      >
        {title}
      </div>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '90%',
          maxWidth: 1600,
        }}
      >
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => {
                const opacity = interpolate(frame, [15 + i * 3, 25 + i * 3], [0, 1], {
                  extrapolateRight: 'clamp',
                });
                return (
                  <th
                    key={i}
                    style={{
                      opacity,
                      padding: '16px 20px',
                      fontSize: 24,
                      fontWeight: 700,
                      color: '#2cb4ff',
                      borderBottom: '2px solid #2cb4ff',
                      textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => {
            const rowDelay = 25 + ri * 5;
            const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 15], [0, 1], {
              extrapolateRight: 'clamp',
            });
            return (
              <tr key={ri} style={{ opacity: rowOpacity }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '14px 20px',
                      fontSize: 22,
                      color: '#e0e0e8',
                      borderBottom: '1px solid #2a2b3e',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </AbsoluteFill>
  );
};
