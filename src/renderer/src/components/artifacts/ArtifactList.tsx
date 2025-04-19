import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Code, 
  FileText, 
  Globe, 
  Image,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { Artifact } from '@/types/artifact';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface ArtifactListProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * アーティファクトリストコンポーネント
 * 作成したアーティファクトの一覧を表示
 */
export const ArtifactList: React.FC<ArtifactListProps> = ({
  artifacts,
  activeArtifactId,
  onSelect,
  onDelete
}) => {
  // アーティファクトのタイプに応じたアイコンを取得
  const getArtifactIcon = (type: Artifact['type']) => {
    switch (type) {
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'markdown':
        return <FileText className="h-4 w-4" />;
      case 'html':
        return <Globe className="h-4 w-4" />;
      case 'svg':
        return <Image className="h-4 w-4" />;
      case 'mermaid':
        return <LayoutGrid className="h-4 w-4" />;
      case 'react':
        return <LayoutGrid className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-muted-foreground">
        アーティファクトがありません
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="relative group">
            <Button
              variant={activeArtifactId === artifact.id ? "secondary" : "ghost"}
              className="w-full justify-start text-sm pr-8"
              onClick={() => onSelect(artifact.id)}
            >
              {getArtifactIcon(artifact.type)}
              <div className="ml-2 flex flex-col items-start overflow-hidden w-full">
                <span className="truncate w-full">
                  {artifact.title}
                </span>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {artifact.type}
                </span>
              </div>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 transform -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(artifact.id);
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
