const forms = document.querySelectorAll('[data-support-form]');
const supportParams = new URLSearchParams(window.location.search);

const prefillField = (form, key) => {
  const value = supportParams.get(key)?.trim();
  if (!value) return;

  const field = form.querySelector(`[data-prefill="${key}"]`);
  if (field instanceof HTMLSelectElement) {
    const hasOption = Array.from(field.options).some((option) => option.value === value);
    if (hasOption) field.value = value;
    return;
  }

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    field.value = value;
  }
};

for (const form of forms) {
  prefillField(form, 'topic');
  prefillField(form, 'message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const statusNode = form.querySelector('.form-status');
    const submitButton = form.querySelector('button[type="submit"]');

    if (!statusNode || !submitButton) return;
    if (submitButton.disabled) return;

    const defaultButtonText =
      submitButton.dataset.defaultText || submitButton.textContent?.trim() || 'Send';
    submitButton.dataset.defaultText = defaultButtonText;

    statusNode.className = 'form-status';
    statusNode.textContent = 'Sending...';
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Sending...';

    try {
      const endpoint = form.getAttribute('action') || '/api/support';
      const formData = new FormData(form);

      const files = formData.getAll('screenshots').filter((file) => file instanceof File && file.size > 0);
      if (files.length > 3) {
        throw new Error('Please upload at most 3 images.');
      }
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error('Each image must be 8MB or less.');
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Unable to send your request right now.');
      }

      statusNode.classList.add('success');
      statusNode.textContent = payload.message || 'Message sent successfully.';
      form.reset();
    } catch (error) {
      statusNode.classList.add('error');
      statusNode.textContent = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
      submitButton.removeAttribute('aria-busy');
      submitButton.textContent = defaultButtonText;
    }
  });
}
