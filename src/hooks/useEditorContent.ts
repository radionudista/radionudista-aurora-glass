import { useOptionalEditor } from '../contexts/EditorContext';
import { usePublicContent } from '../contexts/PublicContentContext';

export const useContentIndexData = () => {
  const editor = useOptionalEditor();
  const publicContent = usePublicContent();
  return editor?.contentIndex ?? publicContent.contentIndex;
};

export const useEditorialText = () => {
  const editor = useOptionalEditor();
  const publicContent = usePublicContent();
  return editor?.editorial ?? publicContent.editorial;
};
