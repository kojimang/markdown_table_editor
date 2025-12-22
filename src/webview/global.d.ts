declare module "*.css";

interface VsCodeApi {
    postMessage(message: any): void;
    setState(state: any): void;
    getState(): any;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface Window {
    initialData: string[][];
}
