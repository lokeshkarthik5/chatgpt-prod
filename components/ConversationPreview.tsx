import React from 'react';

const ConversationPreview = ({ conv }) => {
  const previewText = conv?.messages?.[0]?.content
    ? `${conv.messages[0].content.substring(0, 30)}...`
    : 'New Conversation';

  return (
    <div className="p-4 border rounded-lg mb-2 hover:bg-gray-100">
      <h3 className="font-semibold">{previewText}</h3>
      {/* Add more details here if needed */}
    </div>
  );
};

export default ConversationPreview;