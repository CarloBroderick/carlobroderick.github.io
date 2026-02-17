# Carlo Broderick - Personal Website

A clean, editorial-style personal website showcasing environmental data science work.

## Features

- **Responsive Design** - Works on all devices
- **Editorial Layout** - Intentionally non-templated aesthetic
- **Real Content** - Populated with actual work experience and projects
- **GitHub Pages Ready** - Static HTML/CSS/JS for easy hosting

## Sections

1. **Intro** - Brief introduction and current work
2. **About** - Background, education, and approach to data science
3. **Work** - Key projects including wildfire evacuation analysis and Ocean Health Index
4. **Toolbox** - Technical skills organized by category
5. **Contact** - Links to LinkedIn and GitHub

## Deployment to GitHub Pages 🚀

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `<your-username>.github.io` (e.g., `carlobroderick.github.io`)
3. Make it **public**
4. Don't initialize with README (we already have one)

### Step 2: Initialize Git and Push

Open terminal in the `personal-website` folder and run:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit: Carlo Broderick personal website"

# Add your GitHub repository as remote (replace with your actual repo URL)
git remote add origin git@github.com:<your-username>/<your-username>.github.io.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under "Source", select **main** branch and **/ (root)** folder
4. Click **Save**
5. Your site will be live at `https://<your-username>.github.io` in a few minutes!

## What's Included

The website now contains your real information:
- Current position at NCEAS
- Fulbright Scholar status
- Educational background (UC Santa Barbara, UC Santa Cruz)
- Real projects including the wildfire evacuation route analysis with live link
- Accurate technical skills
- Links to your actual LinkedIn and GitHub

## Future Updates

As you complete more projects, you can add them to the Work section. The wildfire map project links to your actual published interactive visualization.

### Customizing Colors

The site uses a warm, editorial color scheme. Edit CSS variables in `styles.css` at the top to adjust:

```css
:root {
    --color-bg:        #faf9f7;  /* Warm paper background */
    --color-accent:    #b45309;  /* Amber accent */
    --color-text:      #2c2c2c;  /* Main text color */
}
```

## Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS Grid and custom properties
- **Google Fonts** - Source Serif 4, Inter, and JetBrains Mono
- **JavaScript** - Minimal JS for mobile nav and smooth scrolling
- **No frameworks** - Pure vanilla web technologies

## Browser Support 🌐

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Design Philosophy

This site intentionally avoids common "AI-generated portfolio" aesthetics:
- No purple gradients or perfectly symmetrical card grids
- Mix of serif and sans-serif fonts for personality
- Warm, papery background instead of stark white
- Conversational, authentic tone
- Editorial layout with varied section structures

---

© 2026 Carlo Broderick
