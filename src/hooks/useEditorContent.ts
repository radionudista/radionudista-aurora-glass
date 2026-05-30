import contentIndexData from '../contentIndex.json';
import { useOptionalEditor } from '../contexts/EditorContext';

export const useContentIndexData = () => {
  const editor = useOptionalEditor();
  return editor?.contentIndex ?? contentIndexData;
};

export const useEditorialText = () => {
  const editor = useOptionalEditor();
  return editor?.editorial ?? null;
};
