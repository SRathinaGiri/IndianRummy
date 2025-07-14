# Classic Indian Rummy - A Progressive Web App

This is a fully-featured, web-based Rummy card game built with HTML, CSS, and modern JavaScript. It was developed as a collaborative project to showcase advanced game logic, a smart AI opponent, and modern web features like Progressive Web App (PWA) capabilities for offline play.

## Features

- **Classic Indian Rummy Rules:** Plays with 1 human player against 1 to 3 AI opponents, using a multi-deck shoe of cards.
- **Smart AI Opponent:** The AI evaluates its hand to make strategic decisions, keeps track of discarded cards and opponent pickups, and will declare to win the round.
- **Progressive Web App (PWA):** The game can be "installed" on a desktop or mobile home screen for a native app-like experience.
- **Offline Capable:** Thanks to a service worker, the game caches all necessary assets and can be played anytime, anywhere, even without an internet connection.
- **Authentic Rules Implemented:**
  - Wild Joker & Printed Jokers.
  - Mandatory two sequences, including one pure sequence, for a valid declaration.
  - "Golden Rummy" (a set of three identical cards) is correctly treated as a pure sequence.
  - Correct point calculation for opponents' deadwood on declaration.
- **Learner Mode:** An optional mode to see the AI's cards and its calculated potential points in real-time, perfect for learning the game's strategy.
- **Smooth Animations:** All player actions, such as dealing, drawing, and discarding, are represented by clean and logical animations.

## How to Run Locally

Because this project uses modern JavaScript Modules, it must be run from a local web server. You cannot just open the `index.html` file in your browser.

1.  Clone or download the project files into a single folder.
2.  Open a command prompt or terminal in the project's root directory.
3.  If you have Python 3 installed, you can start a simple web server with the following command:
    ```bash
    python -m http.server
    ```
4.  Open your web browser (Chrome is recommended for the best PWA features) and navigate to:
    ```
    http://localhost:8000
    ```
5.  The game should now be running correctly. Look for the "Install" icon in your browser's address bar to add it to your device.

## How to Play

The objective is to be the first to arrange all 13 of your cards into valid sequences and sets. For a detailed guide on the rules we implemented, please see the `how-to-play.html` page.

### Basic Gameplay
1.  **Draw:** On your turn, draw a card from either the closed **Stock** pile or the open **Discard** pile.
2.  **Meld:** If you have valid sequences or sets, you can group them by selecting the cards and clicking the "Group" button.
3.  **Discard:** You must end your turn by discarding one card to the Discard pile.

---
*This game was built by S. Rathinagiri, working as a coding partner with Google Gemini and ChatGPT Codex.*
