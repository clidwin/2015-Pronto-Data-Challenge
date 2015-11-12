function hideAboutDescription() {
    document.getElementById('about-desc').style.display = 'none';
}

function hideUsageDescription() {
    document.getElementById('use-desc').style.display = 'none';
}

function showAboutDescription() {
    document.getElementById('about-desc').style.display = 'block';
    document.getElementById('use-desc').style.display = 'none';
}

function showUsageDescription() {
    document.getElementById('about-desc').style.display = 'none';
    document.getElementById('use-desc').style.display = 'block';
}

function hideAllDescriptions() {
    hideUsageDescription();
    hideAboutDescription();
}

