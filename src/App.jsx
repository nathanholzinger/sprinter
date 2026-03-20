import { useState } from 'react';
import { TemplateProvider } from './store/useTemplateStore';
import TemplateList from './components/templates/TemplateList';
import TemplateEditor from './components/templates/TemplateEditor';

function AppContent() {
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  if (editingTemplateId) {
    return (
      <TemplateEditor
        templateId={editingTemplateId}
        onBack={() => setEditingTemplateId(null)}
      />
    );
  }

  return <TemplateList onEditTemplate={setEditingTemplateId} />;
}

export default function App() {
  return (
    <TemplateProvider>
      <AppContent />
    </TemplateProvider>
  );
}
