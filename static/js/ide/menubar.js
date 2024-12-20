////////////////////////////////////////////////////////////////////////////////
// This file contains the logic for the menubar at the top of the IDE app.
////////////////////////////////////////////////////////////////////////////////

$(document).ready(() => {
  $('.menubar [data-keystroke]').each((_, element) => setMenubarKeystrokeIcons(element));
  registerMenubarEventListeners();

  // Disable the connect repo button if no credentials are set yet.
  const gitToken = getLocalStorageItem('git-access-token');
  if (!gitToken) {
    $('#menu-item--connect-repo').addClass('disabled');
  }
});

// ===========================================================================
// Functions
// ===========================================================================

/**
 * Replaces the `data-keystroke` attribute with the appropriate symbols for a
 * single list-item in the menubar.
 *
 * @param {DOMElement} element - One list-item from the menubar.
 */
function setMenubarKeystrokeIcons(element) {
  const keystroke = $(element).data('keystroke')
    .replace('CTRL_META', isMac() ? '\u2318' : 'Ctrl')
    .replace('ALT_OPTION', isMac() ? '\u2325' : 'Alt')
    .replace('CTRL', isMac() ? '\u2303' : 'Ctrl')
    .replace('SHIFT', '\u21E7')
    .replace('ENTER', '\u23CE')
    .replace('UP', '\u2191')
    .replace('DOWN', '\u2193')
    .replace('LEFT', '\u2190')
    .replace('RIGHT', '\u2192');

  const currentText = $(element).text();
  $(element).html(`
    <span class="text">${currentText}</span>
    <span class="keystroke">${keystroke}</span>
  `);
}

const closeActiveMenuBarMenu = (event) => {
  // Focus the active editor tab, except for making new files/folders.
  // Check if the event.target has neither the id menu-item--new-file and
  // and menu-item--new-folder.
  const isInsideMenu = $('.menubar > li.open').find($(event.target)).length > 0;
  const isNotNewFileOrFolderBtn = !$(event.target).is('#menu-item--new-file, #menu-item--new-folder');
  const editor = getActiveEditor().instance.editor;
  if (isInsideMenu && isNotNewFileOrFolderBtn && editor) {
    // Set window._blockLFSPolling to prevent file contents being reloaded
    window._blockLFSPolling = true;
    editor.focus();
    window._blockLFSPolling = false;
  }

  // Close the active menu only when it is not a disabled menu item.
  if (!$('.menubar > li.open').find($(event.target)).hasClass('disabled')) {
    $('.menubar > li.open').removeClass('open');
  }
}

// Open the first menu level when clicking the main menubar items.
$('.menubar > li').click((event) => {
  // Check if the clicked item is one of the menubar children.
  const $listItem = $(event.target);
  if ($listItem.parent().hasClass('menubar')) {
    $listItem.toggleClass('open').siblings().removeClass('open');
  }
});


/**
 * Registers onclick handlers for all actions in the menubar as well as global
 * keyboard shortcuts in the document.
 */
function registerMenubarEventListeners() {
  // Main menu items.
  // ================

  // Close menu when clicking outside of it.
  $(document).click((event) => {
    if (!$(event.target).closest('.menubar').length) {
      closeActiveMenuBarMenu(event);
    }
  });

  // Close menu when pressing ESC.
  $(document).keydown((event) => {
    if (event.key === 'Escape') {
      closeActiveMenuBarMenu(event);
    }
  });

  // Close menu when clicking on a menu item.
  $('.menubar > li li').click((event) => {
    closeActiveMenuBarMenu(event);
  });

  // All submenu item event listeners.
  // =================================
  $('#menu-item--new-file').click(() => createNewFileTreeFile());
  Mousetrap.bind(['ctrl+t'], () => createNewFileTreeFile());

  $('#menu-item--new-folder').click(() => createNewFileTreeFolder());
  Mousetrap.bind(['ctrl+shift+t'], () => createNewFileTreeFolder());

  $('#menu-item--close-file').click(closeFile);
  Mousetrap.bind(['ctrl+w'], closeFile);

  $('#menu-item--comment').click(Menubar.toggleComment);

  $('#menu-item--close-folder').click(Menubar.closeLFSFolder);
  $('#menu-item--open-folder').click(Menubar.openLFSFolder);
  Mousetrap.bind(['ctrl+shift+o'], Menubar.openLFSFolder);

  $('#menu-item--undo').click(Menubar.undo);
  $('#menu-item--redo').click(Menubar.redo);

  $('#menu-item--copy').click(Menubar.copyToClipboard);
  $('#menu-item--cut').click(Menubar.cut);
  $('#menu-item--paste').click(Menubar.pasteFromClipboard);

  $('#menu-item--move-lines-up').click(Menubar.moveLinesUp);
  $('#menu-item--move-lines-down').click(Menubar.moveLinesDown);

  $('#menu-item--indent').click(Menubar.indent);
  $('#menu-item--outdent').click(Menubar.outdent);

  $('#menu-item--find-next').click(Menubar.findNext);
  $('#menu-item--find-previous').click(Menubar.findPrev);

  $('#menu-item--search').click(Menubar.search);
  Mousetrap.bind(['ctrl+f', 'meta+f'], Menubar.search);

  $('#menu-item--replace').click(Menubar.replace);

  $('#menu-item--run-tab').click(Menubar.runTab);

  $('#menu-item--add-credentials').click(Menubar.addCredentials);
  $('#menu-item--connect-repo').click(Menubar.connectRepo);

  // Prevent the default browser save dialog when pressing ctrl+s or cmd+s.
  Mousetrap.bind(['ctrl+s', 'meta+s'], (event) => event.preventDefault());
}

const Menubar = {};

Menubar.openNewFile = () => {
  createNewFileTreeFile();
};

Menubar.openLFSFolder = () => {
  VFS._lfs('openFolderPicker').then(() => {
    $('#file-tree .info-msg').remove();
    $('#menu-item--close-folder').removeClass('disabled');
  });
};

Menubar.closeLFSFolder = (event) => {
  if ($('#menu-item--close-folder').hasClass('disabled')) return;

  VFS._lfs('closeFolder');
  closeActiveMenuBarMenu(event);
};

Menubar.undo = () => {
  getActiveEditor().instance.editor.undo();
};

Menubar.redo = () => {
  getActiveEditor().instance.editor.redo();
};

Menubar.copyToClipboard = () => {
  const editor = getActiveEditor().instance.editor;
  if (!editor.selection.isEmpty()) {
    const text = editor.getSelectedText();
    navigator.clipboard.writeText(text);
  }
};

Menubar.cut = () => {
  Menubar.copyToClipboard();

  // Cut the selected text.
  getActiveEditor().instance.editor.insert('');
};

Menubar.toggleComment = () => {
  getActiveEditor().instance.editor.toggleCommentLines();
}

Menubar.moveLinesUp = () => {
  getActiveEditor().instance.editor.moveLinesUp();
}

Menubar.moveLinesDown = () => {
  getActiveEditor().instance.editor.moveLinesDown();
}

Menubar.pasteFromClipboard = () => {
  navigator.clipboard.readText().then((text) => {
    getActiveEditor().instance.editor.insert(text);
  });
};

Menubar.indent = () => {
  getActiveEditor().instance.editor.blockIndent();
};

Menubar.outdent = () => {
  getActiveEditor().instance.editor.blockOutdent();
};

Menubar.findNext = () => {
  getActiveEditor().instance.editor.findNext();
}

Menubar.findPrev = () => {
  getActiveEditor().instance.editor.findPrevious();
}

Menubar.search = () => {
  getActiveEditor().instance.editor.execCommand('find');
};

Menubar.replace = () => {
  getActiveEditor().instance.editor.execCommand('replace');
};

Menubar.runTab = () => {
  getActiveEditor().instance.editor.execCommand('run');
};

Menubar.addCredentials = () => {
  const accessToken = getLocalStorageItem('git-access-token', '');
  const $modal = createModal({
    title: 'Add GitHub credentials',
    body: `
      <div class="form-wrapper-full-width">
        <label>Personal access token:</label>
        <input type="password" class="text-input full-width-input git-access-token" value="${accessToken}" placeholder="Fill in your personal access token" />
      </div>

      <p class="text-small">
        GitHub access tokens can be created <a href="https://github.com/settings/tokens">here</a>.
        Make sure to at least check the <em>repo</em> scope such that all its subscopes are checked.
        <br\>
        <br\>
        In order to clone private repositories or push and pull contents from any repository, your GitHub personal access token is required.
        Credentials will be stored locally in your browser and will not be shared with anyone.
      </p>
    `,
    footer: `
      <button type="button" class="button cancel-btn">Cancel</button>
      <button type="button" class="button primary-btn confirm-btn">Save</button>
    `,
    attrs: {
      id: 'ide-git-creds-modal',
      class: 'modal-width-small',
    }
  });

  showModal($modal);

  $modal.find('.cancel-btn').click(() => hideModal($modal));
  $modal.find('.confirm-btn').click(() => {
    const accessToken = $modal.find('.git-access-token').val();
    if (accessToken) {
      $('#menu-item--connect-repo').removeClass('disabled');
      setLocalStorageItem('git-access-token', accessToken);
    } else {
      removeLocalStorageItem('git-access-token');

      // No credentials set, disable connect repo button.
      $('#menu-item--connect-repo').addClass('disabled');
    }

    hideModal($modal);
  });
};

Menubar.connectRepo = () => {
  const initialRepoLink = getLocalStorageItem('connected-repo', '');

  const localFilesNotice = initialRepoLink
    ? '<p class="text-small">Leave empty to disconnect from the repository.</p>'
    : `
      <p class="text-small">
        ❗️ Local files will be permanently discarded when connecting a new repository.
        If you want to keep your local files, please download them manually before continuing.
      </p>
    `;

  const $connectModal = createModal({
    title: 'Connect repository',
    body: `
      <p>Only GitHub repostory links are supported. Leave empty to disconnect from the repository.</p>
      <input class="text-input full-width-input repo-link" value="${initialRepoLink}" placeholder="https://github.com/{owner}/{repo}"></textarea>
      ${localFilesNotice}

    `,
    footer: `
      <button type="button" class="button cancel-btn">Cancel</button>
      <button type="button" class="button primary-btn confirm-btn">Connect</button>
    `,
    attrs: {
      id: 'ide-connect-repo-modal',
      class: 'modal-width-small',
    }
  });

  showModal($connectModal).then(() => {
    $('#ide-connect-repo-modal .repo-link').focus();
  });

  // Change the connect to a disconnect button when the repo link is removed.
  if (initialRepoLink) {
    $connectModal.find('.repo-link').on('keyup', (event) => {
      const repoLink = event.target.value;
      if (!repoLink) {
        $connectModal.find('.primary-btn').removeClass('primary-btn').addClass('danger-btn').text('Disconnect');
      } else {
        $connectModal.find('.danger-btn').addClass('primary-btn').removeClass('danger-btn').text('Connect');
      }
    });
  }

  $connectModal.find('.cancel-btn').click(() => hideModal($connectModal));
  $connectModal.find('.confirm-btn').click(() => {
    const repoLink = $connectModal.find('.repo-link').val().trim();

    // For now, we only allow GitHub repo links.
    if (repoLink && !/^https:\/\/github.com\/([\w-]+)\/([\w-]+)(?:\.git)?/.test(repoLink)) {
      alert('Invalid GitHub repository');
      return;
    }

    if (repoLink) {
      setLocalStorageItem('connected-repo', repoLink);
      console.log('Connecting to repository:', repoLink);
    } else {
      removeLocalStorageItem('connected-repo');

      showLocalStorageWarning();

      // Clear all files after disconnecting.
      VFS.clear();
      createFileTree();
      setFileTreeTitle('local storage');
    }

    hideModal($connectModal);

    if (initialRepoLink || VFS.isEmpty()) {
      VFS.createGitFSWorker();
    } else if (!VFS.isEmpty()) {
      // Confirms with the user whether they want to discard their local files
      // permanently before connecting to a new repository.

      // Create a new modal after the previous one is hidden.
      setTimeout(() => {
        const $confirmModal = createModal({
          title: 'Are you sure?',
          body: `
            <p>
              You have local files that are not connected to any repository.
              Connecting to your repository will lead to these files being
              discarded permanently.
            </p>
            <p>Are you sure you want to proceed?</p>
          `,
          footer: `
            <button type="button" class="button cancel-btn">No, bring me back</button>
            <button type="button" class="button primary-btn confirm-btn">Yes, I'm sure</button>
          `,
          attrs: {
            id: 'ide-confirm-connect-repo-modal',
            class: 'modal-width-small',
          }
        });

        showModal($confirmModal);

        $confirmModal.find('.cancel-btn').click(() => {
          // Remove the connected repo link from local storage, because if the
          // user would (accidentally) refresh, then it would automatically
          // clone, which we want to prevent.
          removeLocalStorageItem('connected-repo');

          hideModal($confirmModal);
        });
        $confirmModal.find('.confirm-btn').click(() => {
          hideModal($confirmModal);
          VFS.createGitFSWorker();
        });

      }, MODAL_ANIM_DURATION);
    }
  });
};
