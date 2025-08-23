import { createRoot } from 'react-dom/client';
import ResultApp from './ResultApp';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<ResultApp />);
