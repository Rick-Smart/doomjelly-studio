// Sprint 6a: ProjectContext is now a re-export shim.
// All state and logic have moved to DocumentContext.
// Existing consumers keep working unchanged — just swap the import when
// migrating individual files to useDocument() in Sprint 6b+.
export {
  DocumentProvider as ProjectProvider,
  useDocument as useProject,
} from "./DocumentContext";
