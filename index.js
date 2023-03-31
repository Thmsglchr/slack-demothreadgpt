// Import required packages and modules
const { App } = require("@slack/bolt");
const { blocksTemplate } = require("./blocksTemplate");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Store added users
let addedUsers = [];

// Returns an array of block objects for the home view
function buildHomeBlocks() {
  return [
    ...blocksTemplate,
    ...addedUsers.flatMap((user, index) => [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `User ${index + 1}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Name:*\n${user.name}\n\n*Position:*\n${user.position}`,
        },
        accessory: {
          type: "image",
          image_url: `${user.picture}`,
          alt_text: `${user.name}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Edit",
            },
            action_id: `edit_user_${user.userId}`,
            value: user.userId,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Delete",
            },
            action_id: `delete_user_${user.userId}`,
            value: user.userId,
            style: "danger",
          },
        ],
      },
    ]),
  ];
}

// Publishes the updated home view to the target user's app home
async function updateHomeView({ token, user_id }) {
  try {
    await app.client.views.publish({
      token, // Use the user token
      user_id,
      view: {
        type: 'home',
        callback_id: 'home_view',
        blocks: buildHomeBlocks()
      }
    });
  } catch (error) {
    console.error(error);
  }
}


// Opens a modal with a form to add or edit user information
async function openUserModal({ trigger_id, token, user = null }) {
  const modal = {
    type: 'modal',
    callback_id: user ? `edit_user_modal_${user.userId}` : 'add_user_modal',
    title: {
      type: 'plain_text',
      text: user ? 'Edit User' : 'Add User'
    },
    submit: {
      type: 'plain_text',
      text: user ? 'Save' : 'Add'
    },
    close: {
      type: 'plain_text',
      text: 'Cancel'
    },
    blocks: [
      {
        type: 'input',
        block_id: 'name_block',
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: {
            type: 'plain_text',
            text: 'Enter a name'
          },
          initial_value: user ? user.name : undefined
        },
        label: {
          type: 'plain_text',
          text: 'Name'
        }
      },
      {
        type: 'input',
        block_id: 'position_block',
        element: {
          type: 'plain_text_input',
          action_id: 'position_input',
          placeholder: {
            type: 'plain_text',
            text: 'Enter a job position'
          },
          initial_value: user ? user.position : undefined
        },
        label: {
          type: 'plain_text',
          text: 'Position'
        }
      },
      {
        type: 'input',
        block_id: 'picture_block',
        element: {
          type: 'plain_text_input',
          action_id: 'picture_input',
          placeholder: {
            type: 'plain_text',
            text: 'Enter a picture URL'
          },
          initial_value: user ? user.picture : undefined
        },
        label: {
          type: 'plain_text',
          text: 'Picture'
        }
      }
    ]
  };

  try {
    await app.client.views.open({
      token,
      trigger_id,
      view: modal
    });
  } catch (error) {
    console.error(error);
  }
}

// Returns a generated conversation array by calling the OpenAI API
async function generateDiscussion(body, context) { 
  const topic = body.view.state.values.topic_block.topic_input.value;
  const company = body.view.state.values.company_block.company_input.value;
  const numMessages = parseInt(
    body.view.state.values.num_messages_block.num_messages_select.selected_option
      .value
  );
  
  const channelId = body.view.state.values.channel_block.channel_select.selected_channel;

  // Post an initial message to inform users that the conversation is being generated
  const initialMessage = await app.client.chat.postMessage({
    token: context.botToken,
    channel: channelId,
    text: "Generating conversation...",
  });

  // Generate the conversation and update the initial message
  await generateAndPostConversation(
    context,
    body,
    channelId,
    topic,
    company,
    numMessages,
    initialMessage.ts
  );
}

// Calls generateDiscussion and sends the generated conversation to the specified channel
async function generateAndPostConversation(context, body, channelId, topic, company, numMessages, initialMessageTs) {
  try {
    const participants = addedUsers
      .map((user) => `${user.name} (${user.position} at ${company})`)
      .join(", ");

    const prompt = `Generate a conversation between ${participants} about the topic "${topic}". The conversation should have ${numMessages} messages.`;

    // Call the OpenAI API to generate the discussion
    const result = await openai.createCompletion({
      model: "text-davinci-002",
      prompt,
      max_tokens: 150 * numMessages,
      temperature: 0.8,
    });

    // Extract messages from the generated text
    const messages = result.data.choices[0].text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => line.replace(/^.*?:\s*/, ''))
    .slice(0, numMessages);
  
    // Update the initial message with the generated conversation
    const conversationText = messages.join("\n");
    await app.client.chat.update({
      token: context.botToken,
      channel: channelId,
      text: conversationText,
      ts: initialMessageTs,
    });

    // Delete the initial message
    await app.client.chat.delete({
      token: context.botToken,
      channel: channelId,
      ts: initialMessageTs,
    });

    // Post messages in a thread with custom username and avatar
    const parentMessage = await app.client.chat.postMessage({
      token: context.botToken,
      channel: channelId,
      text: messages[0],
      username: addedUsers[0].name,
      icon_url: addedUsers[0].picture,
    });

    for (let i = 1; i < messages.length; i++) {
      await app.client.chat.postMessage({
        token: context.botToken,
        channel: channelId,
        text: messages[i],
        thread_ts: parentMessage.ts,
        username: addedUsers[i % addedUsers.length].name,
        icon_url: addedUsers[i % addedUsers.length].picture,
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error object:', error);
  }
}

// Triggered when the app home is opened, updates the home view for the user=
app.event('app_home_opened', async ({ event, context }) => {
  await updateHomeView({ token: context.botToken, user_id: event.user });
});

// Listener for when the 'generate_discussion_modal' view is submitted
app.view("generate_discussion_modal", async ({ ack, body, view, context }) => {
  await ack();
  await generateDiscussion(body, context);
});

// Listener for when the 'add_conversation_user' action is triggered
app.action('add_conversation_user', async ({ ack, body, context }) => {
  await ack();
  await openUserModal({ trigger_id: body.trigger_id, token: context.botToken });
});

// Listener for when the 'add_user_modal' view is submitted
app.view('add_user_modal', async ({ ack, body, view, context }) => {
  await ack();

  const userId = `user_${Date.now()}`;
  const name = view.state.values.name_block.name_input.value;
  const position = view.state.values.position_block.position_input.value;
  const picture = view.state.values.picture_block.picture_input.value;

  addedUsers.push({ userId, name, position, picture });

  try {
    await app.client.views.publish({
      token: context.botToken,
      user_id: body.user.id,
      view: {
        type: 'home',
        callback_id: 'home_view',
        blocks: buildHomeBlocks()
      }
    });
  } catch (error) {
    console.error(error);
  }
});

// Listener for when an 'edit_user_modal_*' view is submitted
app.view(/edit_user_modal_user_.*/, async ({ ack, body, view, context }) => {
  await ack();

  const userId = view.callback_id.match(/edit_user_modal_(.*)/)[1];
  const name = view.state.values.name_block.name_input.value;
  const position = view.state.values.position_block.position_input.value;
  const picture = view.state.values.picture_block.picture_input.value;

  const userIndex = addedUsers.findIndex(user => user.userId === userId);
  addedUsers[userIndex] = { userId, name, position, picture };

  try {
    await app.client.views.publish({
      token: context.botToken,
      user_id: body.user.id,
      view: {
        type: 'home',
        callback_id: 'home_view',
        blocks: buildHomeBlocks()
      }
    });
  } catch (error) {
    console.error(error);
  }
});

// Listener for when an 'edit_user_*' action is triggered
app.action(/edit_user_.*/, async ({ ack, body, context, action }) => {
  await ack();

  const userId = action.value;
  const user = addedUsers.find((user) => user.userId === userId);

  if (user) {
    await openUserModal({
      trigger_id: body.trigger_id,
      token: context.botToken,
      user,
    });
  } else {
    console.error(`User not found: ${userId}`);
  }
});

// Delete button listener
app.action(/delete_user_.*/, async ({ ack, body, context, action }) => {
  await ack();

  const userId = action.value;
  addedUsers = addedUsers.filter((user) => user.userId !== userId);

  try {
    await app.client.views.publish({
      token: context.botToken,
      user_id: body.user.id,
      view: {
        type: "home",
        callback_id: "home_view",
        blocks: buildHomeBlocks(),
      },
    });
  } catch (error) {
    console.error(error);
  }
});

// Listener for when the 'generate_discussion' action is triggered
app.action("generate_discussion", async ({ ack, body, context }) => {
  await ack();
  await generateDiscussion(body, context);  
});

// Listener for when the app is mentioned in a channel
app.event("app_mention", async ({ event, context }) => {
  try {
    await app.client.chat.postMessage({
      token: context.botToken,
      channel: event.channel,
      text: `Hello, <@${event.user}>! I'm here to help.`
    });
  } catch (error) {
    console.error(`Error responding to app_mention: ${error}`);
  }
});

// Error handling
app.error(async (error) => {
  console.error(`Error not caught by other listeners: ${error.message}`);
  console.error(error.stack); // Add this line
});

// Start your app
(async () => {
  await app.start(process.env.PORT || 3000);
})();