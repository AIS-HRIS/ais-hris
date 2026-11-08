import {createRoot} from 'react-dom/client';
import Workspace from '../src/views/Workspace';
import '../app/globals.css';
import '../app/redesign.css';
import '../app/experience.css';

createRoot(document.getElementById('root')).render(<Workspace/>);
