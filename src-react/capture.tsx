import { createRoot } from 'react-dom/client';
import CaptureApp from './CaptureApp';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<CaptureApp />);
