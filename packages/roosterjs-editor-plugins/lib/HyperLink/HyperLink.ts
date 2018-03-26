import { Browser, matchLink } from 'roosterjs-editor-dom';
import {
    replaceTextBeforeCursorWithNode,
    cacheGetCursorEventData,
    clearCursorEventDataCache,
} from 'roosterjs-editor-api';
import {
    ChangeSource,
    ContentChangedEvent,
    ExtractContentEvent,
    PluginDomEvent,
    PluginEvent,
    PluginEventType,
} from 'roosterjs-editor-types';
import { Editor, EditorPlugin } from 'roosterjs-editor-core';

// When user type, they may end a link with a puncatuation, i.e. www.bing.com;
// we need to trim off the trailing puncatuation before turning it to link match
const TRAILING_PUNCTUATION_REGEX = /[.()+={}\[\]\s:;"',>]+$/i;
const TEMP_TITLE_REGEX = /<a\s+([^>]*\s+)?(title|istemptitle)="[^"]*"\s*([^>]*)\s+(title|istemptitle)="[^"]*"(\s+[^>]*)?>/gm;
const TEMP_TITLE = 'istemptitle';
const MINIMUM_LENGTH = 5;
const KEY_SPACE = 32;
const KEY_ENTER = 13;

/**
 * An editor plugin that auto linkify text as users type and show a tooltip for existing link
 */
export default class HyperLink implements EditorPlugin {
    private editor: Editor;

    /**
     * Create a new instance of HyperLink class
     * @param getTooltipCallback A callback function to get tooltip text for an existing hyperlink.
     * Default value is to return the href itself. If null, there will be no tooltip text.
     * @param target (Optional) Target window name for hyperlink. If null, will use "_blank"
     * @param linkMatchRules (Optional) Rules for matching hyperlink. If null, will use defaultLinkMatchRules
     */
    constructor(
        private getTooltipCallback: (href: string) => string = href => href,
        private target?: string
    ) {}

    /**
     * Initialize this plugin
     * @param editor The editor instance
     */
    public initialize(editor: Editor) {
        this.editor = editor;

        if (Browser.isIE) {
            this.editor
                .getDocument()
                .execCommand(
                    'AutoUrlDetect',
                    false /* shouldDisplayUserInterface */,
                    false /* value */
                );
        }
    }

    /**
     * Dispose this plugin
     */
    public dispose() {
        this.editor.queryNodes('a[href]', this.resetAnchor);
        this.editor = null;
    }

    /**
     * Handle plugin events
     * @param event The event object
     */
    public onPluginEvent(event: PluginEvent) {
        switch (event.eventType) {
            case PluginEventType.KeyDown:
                let keyboardEvt = (event as PluginDomEvent).rawEvent as KeyboardEvent;
                if (keyboardEvt.which == KEY_ENTER || keyboardEvt.which == KEY_SPACE) {
                    this.autoLink(event);
                }
                break;

            case PluginEventType.ContentChanged:
                let contentChangedEvent = event as ContentChangedEvent;
                if (contentChangedEvent.source == ChangeSource.Paste) {
                    this.autoLink(event);
                } else if (contentChangedEvent.source == ChangeSource.CreateLink) {
                    this.resetAnchor(contentChangedEvent.data as HTMLAnchorElement);
                }

                this.editor.queryNodes('a[href]', this.processLink);
                break;

            case PluginEventType.ExtractContent:
                let extractContentEvent = event as ExtractContentEvent;
                extractContentEvent.content = this.removeTempTooltip(extractContentEvent.content);
                break;
        }
    }

    private resetAnchor = (a: HTMLAnchorElement) => {
        try {
            if (a.getAttribute(TEMP_TITLE)) {
                a.removeAttribute(TEMP_TITLE);
                a.removeAttribute('title');
            }
            a.removeEventListener('mouseup', this.onClickLink);
        } catch (e) {}
    };

    private autoLink(event: PluginEvent) {
        let cursorData = cacheGetCursorEventData(event, this.editor);
        let wordBeforeCursor = cursorData ? cursorData.wordBeforeCursor : null;
        if (wordBeforeCursor && wordBeforeCursor.length > MINIMUM_LENGTH) {
            // Check for trailing punctuation
            let trailingPunctuations = wordBeforeCursor.match(TRAILING_PUNCTUATION_REGEX);
            let trailingPunctuation =
                trailingPunctuations && trailingPunctuations.length > 0
                    ? trailingPunctuations[0]
                    : null;

            // Compute the link candidate
            let linkCandidate = wordBeforeCursor.substring(
                0,
                trailingPunctuation
                    ? wordBeforeCursor.length - trailingPunctuation.length
                    : wordBeforeCursor.length
            );

            // Match and replace in editor
            let linkData = matchLink(linkCandidate);
            if (linkData) {
                let anchor = this.editor.getDocument().createElement('A') as HTMLAnchorElement;
                anchor.textContent = linkData.originalUrl;
                anchor.href = linkData.normalizedUrl;

                this.editor.formatWithUndo(
                    () => {
                        if (
                            replaceTextBeforeCursorWithNode(
                                this.editor,
                                linkData.originalUrl,
                                anchor,
                                trailingPunctuation ? false : true /* exactMatch */,
                                cursorData
                            )
                        ) {
                            // The content at cursor has changed. Should also clear the cursor data cache
                            clearCursorEventDataCache(event);
                        }
                    },
                    false /*preserveSelection*/,
                    ChangeSource.AutoLink,
                    () => anchor
                );
            }
        }
    }

    private processLink = (a: HTMLAnchorElement) => {
        if (!a.title && this.getTooltipCallback) {
            a.setAttribute(TEMP_TITLE, 'true');
            a.title = this.getTooltipCallback(this.tryGetHref(a));
        }
        a.addEventListener('mouseup', this.onClickLink);
    };

    private removeTempTooltip(content: string): string {
        return content.replace(TEMP_TITLE_REGEX, '<a $1$3$5>');
    }

    private onClickLink = (keyboardEvent: KeyboardEvent) => {
        let href: string;
        if (
            !Browser.isFirefox &&
            (href = this.tryGetHref(keyboardEvent.srcElement)) &&
            (Browser.isMac ? keyboardEvent.metaKey : keyboardEvent.ctrlKey)
        ) {
            let target = this.target || '_blank';
            this.editor.getDocument().defaultView.window.open(href, target);
        }
    };

    // Try get href from an anchor element
    // The reason this is put in a try-catch is that
    // it has been seen that accessing href may throw an exception, in particular on IE/Edge
    private tryGetHref(element: Element): string {
        let href: string = null;
        try {
            do {
                if (element.tagName == 'A') {
                    href = (<HTMLAnchorElement>element).href;
                    break;
                }
                element = element.parentElement;
            } while (this.editor.contains(element));
        } catch (error) {
            // Not do anything for the moment
        }

        return href;
    }
}
