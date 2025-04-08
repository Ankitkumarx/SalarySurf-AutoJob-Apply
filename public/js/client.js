document.addEventListener('DOMContentLoaded', () => {
    const configForm = document.getElementById('configForm');
    const addExperienceBtn = document.getElementById('addExperience');
    const addEducationBtn = document.getElementById('addEducation');

    addExperienceBtn.addEventListener('click', () => {
        const experienceFields = document.getElementById('experienceFields');
        const newEntry = experienceFields.children[0].cloneNode(true);
        // Clear the values
        newEntry.querySelectorAll('input, textarea').forEach(input => input.value = '');
        experienceFields.appendChild(newEntry);
    });

    addEducationBtn.addEventListener('click', () => {
        const educationFields = document.getElementById('educationFields');
        const newEntry = educationFields.children[0].cloneNode(true);
        // Clear the values
        newEntry.querySelectorAll('input').forEach(input => input.value = '');
        educationFields.appendChild(newEntry);
    });

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(configForm);
        const config = {
            personalInfo: {},
            jobPreferences: {},
            experience: [],
            education: [],
            preferences: {},
            blacklist: {},
        };

        // Process form data into structured config
        for (let [key, value] of formData.entries()) {
            if (key.includes('[]')) {
                // Handle array fields
                const baseKey = key.replace('[]', '');
                if (!config[baseKey]) config[baseKey] = [];
                config[baseKey].push(value);
            } else {
                // Handle regular fields
                config[key] = value;
            }
        }

        try {
            const response = await fetch('/generate-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });

            if (response.ok) {
                const result = await response.json();
                // Download the configuration file
                downloadConfig(result.config);
            } else {
                throw new Error('Failed to generate configuration');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate configuration file');
        }
    });

    function downloadConfig(config) {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'linkedin-bot-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});