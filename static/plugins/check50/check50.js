(() => {
  const BASE_URL = 'https://agile008.science.uva.nl'

  class Check50Plugin extends TerraPlugin {
    css = ['static/plugins/check50/check50.css'];

    /**
     * Reference to the Check50 button element.
     * @type {jQuery.Element}
     */
    $button = jQuery.noop();

    defaultState = {
      // The password to use for the check50 endpoint.
      password: null,

      // Example key-value pairs:
      // 'absolute/folder/path/to/mario.c': 'minprog/checks/2022/marioless'
      fileslugs: {}
    }

    onLayoutLoaded = () => {
      this.$button = this.createTermButton({
        text: 'Run Check50',
        id: 'run-check50-btn',
        class: 'primary-btn',
        onClick: this.onButtonClick,
      });
    }

    onEditorFocus = (editorComponent) => {
      if (editorComponent.proglang === 'c' && !this.$button.is(':disabled.loading')) {
        this.$button.prop('disabled', false);
      } else {
        this.$button.prop('disabled', true);
      }
    }

    enableCheck50Button = () => {
      this.$button.prop('disabled', false).removeClass('loading');
    }

    disableCheck50Button = () => {
      this.$button.prop('disabled', true).addClass('loading');
    }

    onButtonClick = () => {
      if (this.$button.is(':disabled')) return;

      const tab = Terra.f.getActiveEditor();
      const fileId = tab.container.getState().fileId;
      const filepath = Terra.vfs.getAbsoluteFilePath(fileId);

      // Check if the file has a slug and the check50 password is set.
      // Otherwise, if one of them is not set, prompt the user to fill in the
      // remaining missing values.
      if (!this.getState('fileslugs').hasOwnProperty(filepath) || !this.getState('password')) {
        let body = '';

        if (!this.getState('fileslugs').hasOwnProperty(filepath)) {
          body += `
            <div class="form-wrapper-full-width">
              <label>Slug:</label>
              <input type="text" class="text-input full-width-input slug" placeholder="Fill in the corresponding slug for this file" />
            </div>
          `
        }

        if (!this.getState('password')) {
          body += `
          <div class="form-wrapper-full-width">
            <label>Password:</label>
            <input type="password" class="text-input full-width-input password" placeholder="Fill in the check50 password" />
          </div>
          `
        }

        const $modal = createModal({
          title: 'Check50 information required',
          body,
          footer: `
            <button type="button" class="button cancel-btn">Cancel</button>
            <button type="button" class="button primary-btn">Run Check50</button>
          `,
          attrs: {
            id: 'terra-plugin-run-check50-modal',
            class: 'modal-width-small',
          }
        });

        showModal($modal);

        $modal.find('.cancel-btn').click(() => hideModal($modal));
        $modal.find('.primary-btn').click(() => {
          let hasPassword = $modal.find('.password').length === 0;
          let hasSlug = $modal.find('.slug').length === 0;

          if ($modal.find('.password').length > 0) {
            const password = $modal.find('.password').val().trim();
            if (password) {
              hasPassword = true
              this.setState('password', password);
            } else {
              hasPassword = false;
            }
          }

          if ($modal.find('.slug').length > 0) {
            const slug = $modal.find('.slug').val().trim();
            if (slug) {
              this.setState('fileslugs', {
                ...this.getState('fileslugs'),
                [filepath]: slug
              });
              hasSlug = true;
            } else {
              hasSlug = false;
            }
          }

          if (hasPassword && hasSlug) {
            this.runCheck50();
            hideModal($modal);
          }
        });
      } else {
        this.runCheck50();
      }
    }

    runCheck50 = () => {
      const tab = Terra.f.getActiveEditor();
      const filename = tab.config.title;
      const code = tab.instance.editor.getValue();

      const zip = new JSZip();
      zip.file(filename, code);
      zip.generateAsync({
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: {
            level: 9
        }
      }).then((content) => {
        const fileId = tab.container.getState().fileId;
        const filepath = Terra.vfs.getAbsoluteFilePath(fileId);
        const slug = this.getState('fileslugs')[filepath];

        this.disableCheck50Button();
        const formData = new FormData();
        formData.append('file', content, 'files.zip');
        formData.append('slug', slug);
        formData.append('password', this.getState('password'));

        $('.right-sidebar').html(`
          <div class="check50-results-container">
            <div class="check50-close-btn"></div>
            <div class="check50-title">Check50 results</div>
            <p class="connecting">Connecting....</p>
          </div>
        `);

        // Trigger a resize such that the content is updated.
        $(window).resize();

        // Add small connecting animation that adds a dot every 500ms, delayed by 1 second.
        for (let i = 0; i < 6; i++) {
          setTimeout(() => {
            $('.right-sidebar .connecting').append('.');
          }, Terra.f.seconds(.5) * i + Terra.f.seconds(.5));
        }

        // Add close button handler.
        $('.check50-close-btn').click(() => {
          $('.right-sidebar').html('');
          clearInterval(Terra.v.check50PollingIntervalId);
          this.enableCheck50Button();
          $(window).resize();
        });

        fetch(`${BASE_URL}/check50`, {
          method: 'POST',
          body: formData,
        })
          .then((response) => response.json())
          .then((response) => {
            this.pollCheck50Results(response.id);
          }).catch(() => {
            this.enableCheck50Button();
          });
      });
    }

    pollCheck50Results = (id) => {
      Terra.v.check50PollingIntervalId = setInterval(() => {
        fetch(`${BASE_URL}/get/${id}`)
          .then((response) => response.json())
          .then((response) => {
            if (response.status === 'finished') {
              clearInterval(Terra.v.check50PollingIntervalId);
              this.enableCheck50Button();
              this.showCheck50Results(response.result.check50);
            }
          })
          .catch((error) => {
            this.enableCheck50Button();
          });
      }, Terra.f.seconds(2));
    }

    showCheck50Results = (response) => {
      let html = '';

      if (response.error) {
        const traceback = response.error.traceback.join('').replace('\n', '<br>');
        html += `<div class="error">
          ${response.error.actions.message}<br/>
          <br/>
          ${traceback}
        `;
      } else {
        for (const result of response.results) {
          const statusClass = result.passed ? 'success' : 'error';

          let status = '';
          switch (result.passed) {
            case true: status = ':)'; break;
            case false: status = ':('; break;
            default: status = ':|'; break;
          }

          html += `<div class="check50-result ${statusClass}">
            <div class="check50-result-status">${status}</div>
            <div class="check50-result-message">${result.description}</div>
          </div>`;
        }
      }

      $('.right-sidebar .connecting').remove();
      $('.check50-results-container').append(html);
    }
  }

  Terra.pluginManager.register(new Check50Plugin());

})();
