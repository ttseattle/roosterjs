import toggle from './toggle';
import { Editor } from 'roosterjs-editor-core';

/**
 * Toggle italic at selection
 * If selection is collapsed, it will only affect the input after caret
 * If selection contains only italic text, the italic style will be removed
 * If selection contains only normal text, italic style will be added to the whole selected text
 * If selection contains both italic and normal text, italic stlye will be added to the whole selected text
 * @param editor The editor instance
 */
export default function toggleItalic(editor: Editor) {
    toggle(editor, 'italic');
}
