import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Send } from 'lucide-react';

function App() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // electronAPI.sendMessageToLLM は preload で定義されたもの
      const response = await window.electronAPI.sendMessageToLLM(message);
      setResponse(response);
    } catch (error) {
      console.error('LLMとの通信中にエラーが発生しました:', error);
      setResponse('エラーが発生しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold">LLM Client</h1>
        <p className="text-sm text-muted-foreground">powered by electron-vite & shadcn/ui</p>
      </header>
      
      <main className="flex-1 p-4 flex flex-col">
        <Card className="flex-1 mb-4">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {response ? (
              <div className="p-3 bg-secondary rounded-lg mb-2">{response}</div>
            ) : (
              <div className="text-muted-foreground text-center mt-8">LLMに質問してみましょう</div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="メッセージを入力..."
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={isLoading}>
            {isLoading ? 'Sending...' : <Send size={18} />}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default App;
