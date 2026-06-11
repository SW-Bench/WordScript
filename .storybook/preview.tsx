import type { Preview } from '@storybook/react-vite'
import '../src/styles/globals.css'
import '../src/styles/overlay.css'
import '../src/styles/settings.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'wordscript-dark',
      values: [
        {
          name: 'wordscript-dark',
          value: '#0f1418',
        },
        {
          name: 'wordscript-elevated',
          value: '#1b242c',
        },
      ],
    },
    a11y: {
      test: 'todo'
    }
  },
};

export default preview;