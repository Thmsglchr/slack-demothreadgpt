// This module exports the template for creating Slack blocks
exports.blocksTemplate = [
  {
    // Input block for the topic
    type: 'input',
    block_id: 'topic_block',
    element: {
      type: 'plain_text_input',
      action_id: 'topic_input',
      placeholder: {
        type: 'plain_text',
        text: 'Enter a topic'
      }
    },
    label: {
      type: 'plain_text',
      text: 'Topic:'
    }
  },
  {
    // Input block for the company
    type: 'input',
    block_id: 'company_block',
    element: {
      type: 'plain_text_input',
      action_id: 'company_input',
      placeholder: {
        type: 'plain_text',
        text: 'Enter a company'
      }
    },
    label: {
      type: 'plain_text',
      text: 'Company:'
    }
  },
  {
    // Input block for the number of messages
    type: 'input',
    block_id: 'num_messages_block',
    element: {
      type: 'static_select',
      action_id: 'num_messages_select',
      placeholder: {
        type: 'plain_text',
        text: 'Select number of messages'
      },
      options: [
        { text: { type: 'plain_text', text: '2' }, value: '2' },
        { text: { type: 'plain_text', text: '3' }, value: '3' },
        { text: { type: 'plain_text', text: '4' }, value: '4' },
        { text: { type: 'plain_text', text: '5' }, value: '5' }
      ]
    },
    label: {
      type: 'plain_text',
      text: 'Number of messages'
    }
  },
  {
    // Input block for selecting the channel
    type: 'input',
    block_id: 'channel_block',
    element: {
      type: 'channels_select',
      action_id: 'channel_select',
      placeholder: {
        type: 'plain_text',
        text: 'Select a channel'
      }
    },
    label: {
      type: 'plain_text',
      text: 'Channel:'
    }
  },
  {
    // Section block for adding conversation users
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Add conversation users:*'
    }
  },
  {
    // Actions block for adding a user to the conversation
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Add User'
        },
        action_id: 'add_conversation_user'
      }
    ]
  },
  {
    // Divider block to separate elements
    type: 'divider',
  },
  {
    // Actions block for submitting the form
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Submit',
        },
        action_id: 'generate_discussion',
        style: 'primary',
      },
    ],
  }
];
