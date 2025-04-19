import React from 'react';
import { ArtifactViewer } from './ArtifactViewer';
import { Artifact } from '@/types/artifact';
import { ResizableHandle, ResizablePanel } from '@/components/ui/resizable';

interface ArtifactPanelProps {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * アーティファクトパネルコンポーネント
 * リサイズ可能なパネルでアーティファクトを表示する
 */
export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifact,
  isOpen,
  onClose
}) => {
  if (!isOpen || !artifact) {
    return null;
  }

  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30}>
        <ArtifactViewer artifact={artifact} onClose={onClose} />
      </ResizablePanel>
    </>
  );
};
