import SidePanePluginImpl from '../SidePanePluginImpl';
import SnapshotPane, { SnapshotPaneProps } from './SnapshotPane';

export default class SnapshotPlugin extends SidePanePluginImpl<SnapshotPane, SnapshotPaneProps> {
    constructor() {
        super(SnapshotPane, 'snapshot', 'Snapshot');
    }

    getComponentProps() {
        return {
            onRestoreSnapshot: this.onRestoreSnapshot,
            onTakeSnapshot: this.onTakeSnapshot,
        };
    }

    private onTakeSnapshot = () => {
        return this.editor.getContent(false, true);
    };

    private onRestoreSnapshot = (snapshot: string) => {
        this.editor.focus();
        this.editor.setContent(snapshot);
    };
}
