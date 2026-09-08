from pathlib import Path

path = Path("app/lib/features/growth/components/GrowthDashboard.tsx")
text = path.read_text()

old = '''  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (!draft.templateId) throw new Error("Select a template first.");
      await saveMarketingTemplateSchedule({
        templateId: draft.templateId,
        schedule: draft.schedule,
      });
      setMessage({ text: marketing.settingsSaved });
    } catch (error) {
      console.error("Unable to save marketing cron settings:", error);
      setMessage({ text: marketing.settingsError, error: true });
    } finally {
      setSaving(false);
    }
  };
'''
new = '''  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (!draft.templateId) throw new Error("Select a template first.");
      await updateMarketingTemplate(draft.templateId, {
        destinationUrl: draft.destinationUrl,
        title: draft.title,
        copy: draft.copy,
        callToAction: draft.callToAction,
        photos: draft.photos,
      });
      await saveMarketingTemplateSchedule({
        templateId: draft.templateId,
        schedule: draft.schedule,
      });
      const nextTemplates = await fetchMarketingTemplates();
      setTemplates(nextTemplates);
      const saved = nextTemplates.find((template) => template.id === draft.templateId);
      if (saved) {
        setDraft((current) => ({
          ...current,
          destinationUrl: saved.destinationUrl,
          title: saved.title,
          copy: saved.copy,
          callToAction: saved.callToAction,
          photos: saved.photos,
          schedule: saved.schedule,
        }));
      }
      setMessage({ text: locale === "ko" ? "변경 사항을 저장했습니다." : "Changes saved." });
    } catch (error) {
      console.error("Unable to save marketing changes:", error);
      setMessage({
        text: locale === "ko" ? "변경 사항을 저장하지 못했습니다." : "Changes could not be saved.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };
'''
assert text.count(old) == 1, f"handleSave block count: {text.count(old)}"
text = text.replace(old, new)

old = '''  const handleUpdateTemplate = async () => {
    if (!draft.templateId) return;
    setSavingTemplate(true);
    setMessage(null);
    try {
      await updateMarketingTemplate(draft.templateId, {
        destinationUrl: draft.destinationUrl,
        title: draft.title,
        copy: draft.copy,
        callToAction: draft.callToAction,
        photos: draft.photos,
      });
      const nextTemplates = await fetchMarketingTemplates();
      setTemplates(nextTemplates);
      const saved = nextTemplates.find((template) => template.id === draft.templateId);
      if (saved) {
        setDraft((current) => ({
          ...current,
          destinationUrl: saved.destinationUrl,
          title: saved.title,
          copy: saved.copy,
          callToAction: saved.callToAction,
          photos: saved.photos,
        }));
      }
      setMessage({ text: marketing.templateSaved });
    } catch (error) {
      console.error("Unable to update marketing template:", error);
      setMessage({ text: marketing.templateError, error: true });
    } finally {
      setSavingTemplate(false);
    }
  };

'''
assert text.count(old) == 1, f"handleUpdateTemplate block count: {text.count(old)}"
text = text.replace(old, "")

old = '''  const selectedTemplate = templates.find((template) => template.id === draft.templateId);
  const hasTemplateContent = Boolean(
    draft.destinationUrl.trim() &&
      draft.title.trim() &&
      draft.copy.trim() &&
      draft.callToAction.trim()
  );
  const isTemplateDirty = selectedTemplate
    ? selectedTemplate.destinationUrl !== draft.destinationUrl ||
      selectedTemplate.title !== draft.title ||
      selectedTemplate.copy !== draft.copy ||
      selectedTemplate.callToAction !== draft.callToAction ||
      JSON.stringify(selectedTemplate.photos) !== JSON.stringify(draft.photos)
    : hasTemplateContent;
  const scheduleHasDays = draft.schedule.daysOfWeek.length > 0;
  const canSaveSchedule = Boolean(draft.templateId) && !isTemplateDirty;
'''
new = '''  const hasTemplateContent = Boolean(
    draft.destinationUrl.trim() &&
      draft.title.trim() &&
      draft.copy.trim() &&
      draft.callToAction.trim()
  );
  const scheduleHasDays = draft.schedule.daysOfWeek.length > 0;
  const canSaveChanges = Boolean(draft.templateId) && hasTemplateContent;
'''
assert text.count(old) == 1, f"dirty-state block count: {text.count(old)}"
text = text.replace(old, new)

old = '''            <div className="col-span-full flex flex-wrap items-center gap-[9px]">
              {isTemplateDirty && hasTemplateContent && (
                <SmallButton
                  type="button"
                  disabled={savingTemplate}
                  onClick={() =>
                    draft.templateId
                      ? void handleUpdateTemplate()
                      : setTemplateDialogOpen(true)
                  }
                >
                  {savingTemplate ? <ArrowPathIcon width={14} /> : <CheckIcon width={14} />}
                  {savingTemplate
                    ? marketing.savingTemplate
                    : draft.templateId
                      ? locale === "ko"
                        ? "템플릿 변경 저장"
                        : "Save template changes"
                      : marketing.saveTemplate}
                </SmallButton>
              )}
              {draft.templateId && (
                <SmallButton
                  type="button"
                  disabled={deletingTemplate}
                  onClick={() => void handleDeleteTemplate()}
                >
                  {marketing.deleteTemplate}
                </SmallButton>
              )}
            </div>
'''
new = '''            <div className="col-span-full flex flex-wrap items-center gap-[9px]">
              <SmallButton
                type="button"
                disabled={savingTemplate || !hasTemplateContent}
                onClick={() => {
                  setTemplateName("");
                  setTemplateDialogOpen(true);
                }}
              >
                <PlusIcon width={14} />
                {locale === "ko" ? "새로운 템플릿으로 저장" : "Save as new template"}
              </SmallButton>
              {draft.templateId && (
                <SmallButton
                  type="button"
                  disabled={deletingTemplate}
                  onClick={() => void handleDeleteTemplate()}
                >
                  {marketing.deleteTemplate}
                </SmallButton>
              )}
            </div>
'''
assert text.count(old) == 1, f"template actions block count: {text.count(old)}"
text = text.replace(old, new)

old = '''          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button type="submit" disabled={saving || !canSaveSchedule}>
              {saving ? <ArrowPathIcon width={16} /> : <CheckIcon width={16} />}
              {saving ? marketing.savingSettings : marketing.saveSettings}
            </Button>
'''
new = '''          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button type="submit" disabled={saving || !canSaveChanges}>
              {saving ? <ArrowPathIcon width={16} /> : <CheckIcon width={16} />}
              {saving ? marketing.savingSettings : locale === "ko" ? "변경 사항 저장" : "Save changes"}
            </Button>
'''
assert text.count(old) == 1, f"save button block count: {text.count(old)}"
text = text.replace(old, new)

path.write_text(text)
