// Points Prism's autoloader plugin at this app's own bundled
// Prism/components directory, using an absolute file:// URL.
//
// The autoloader's built-in default (`languages_path: 'components/'`) is
// relative, and the preview's base URL is the user's home directory, not
// the app bundle -- so a relative path always 404s. This bundled Prism
// version also predates `data-autoloader-path`, so there's no built-in way
// to configure this via a script tag attribute.
//
// Rather than hardcode a path (which would break the moment the app is
// installed anywhere other than one specific build-time location), this
// derives the correct path from its own already-resolved, absolute
// `file://` URL -- `document.currentScript.src` -- since MPRenderer always
// loads bundled scripts by absolute URL, wherever the app itself happens
// to be installed.
//
// This file lives in Resources/Extensions, not Resources/Prism: the Prism
// folder is wiped and regenerated from the submodule on every build ("Fetch
// Prism Resources" / "Copy Styles and Prism Resources" build phases), so
// anything placed there directly would be silently deleted on the next
// build.
(function () {
    if (!window.Prism || !Prism.plugins || !Prism.plugins.autoloader) return;
    var src = document.currentScript && document.currentScript.src;
    if (!src) return;
    var prismRoot = src.replace(/Extensions\/[^/]+$/, 'Prism/');
    Prism.plugins.autoloader.languages_path = prismRoot + 'components/';
})();
