const { getModule, getModuleByDisplayName, React, constants: Constants } = require("powercord/webpack");

const MESSAGE_LINK_REGEX =
  /https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(\d{17,19}|@me)\/(\d{17,19})\/(\d{17,19})/g;
const CHANNEL_PATH_REGEX = /\/channels\/(\d+|@me)(?:\/)?(\d+)(?:\/)(\d+)/;

const {default: ChannelMessage} = getModule(
  (x) => x?.default?.type?.displayName == "ChannelMessage",
  false
);

const Embed = getModuleByDisplayName("Embed", false);

const HTTP = getModule(["get", "put"], false);
const ChannelPathHelper = getModule(["isAccessibleChannelOrThreadPath"], false);
const MessageConstructor = getModule(["createMessageRecord"], false);
const {getGuildIconURL} = getModule(["getGuildIconURL"], false);
const {renderMaskedLinkComponent} = getModule(["renderMaskedLinkComponent"], false);

const GuildStore = getModule(["getGuild"], false);
const ChannelStore = getModule(["getChannel", "getDMUserIds"], false);
const MessageStore = getModule(["getMessage", "getMessages"], false);
const UserSettingsStore = getModule(["MessageDisplayCompact"], false);

const SearchResultClasses = getModule([
  "searchResult",
  "message",
  "buttonsContainer"
], false);

const fetchedAttempted = new Set();
const manualMessageCache = new Map();

module.exports = function MessagePreviewAccessory(props) {
  const {message} = props;
  const messageLinks = message.content.match(MESSAGE_LINK_REGEX);

  const [, dummyState] = React.useState();
  const forceUpdate = React.useCallback(() => dummyState({}), []);

  if (messageLinks) {
    const elements = [];

    for (const link of messageLinks) {
      const channelPath = link.match(CHANNEL_PATH_REGEX)[0];
      const parsedChannelPath =
        ChannelPathHelper.tryParseChannelPath(channelPath);

      if (parsedChannelPath.messageId == message.id) continue;

      const referencedGuild =
        parsedChannelPath.guildId == "@me"
          ? null
          : GuildStore.getGuild(parsedChannelPath.guildId);
      const referencedChannel = ChannelStore.getChannel(
        parsedChannelPath.channelId
      );
      const referencedMessage =
        MessageStore.getMessage(
          parsedChannelPath.channelId,
          parsedChannelPath.messageId
        ) || manualMessageCache.get(parsedChannelPath.messageId);

      if (
        !referencedMessage &&
        !fetchedAttempted.has(parsedChannelPath.messageId)
      ) {
        HTTP.get({
          url: Constants.Endpoints.MESSAGES(parsedChannelPath.channelId),
          query: {
            limit: 1,
            around: parsedChannelPath.messageId,
          },
          retries: 2,
          oldFormErrors: true,
        }).then((res) => {
          manualMessageCache.set(
            parsedChannelPath.messageId,
            MessageConstructor.createMessageRecord(res.body[0])
          );
          forceUpdate();
        });
        fetchedAttempted.add(parsedChannelPath.messageId);
      }

      if (
        !referencedMessage ||
        !referencedChannel ||
        (!referencedGuild && parsedChannelPath.guildId != "@me")
      )
        continue;

      const recursion = referencedMessage.content.match(MESSAGE_LINK_REGEX);
      if (recursion) {
        let endRecurse = false;
        for (const sublink of recursion) {
          const subPath = sublink.match(CHANNEL_PATH_REGEX)[0];
          const parsedSubPath = ChannelPathHelper.tryParseChannelPath(subPath);

          if (parsedSubPath.messageId == message.id) {
            endRecurse = true;
            break;
          }
        }
        if (endRecurse) continue;
      }

      const icon =
        parsedChannelPath.guildId == "@me"
          ? null
          : getGuildIconURL({
              id: referencedGuild.id,
              icon: referencedGuild.icon,
              size: 24,
            });

      elements.push(
        React.createElement(Embed, {
          embed: {
            rawDescription: "",
            author: {
              name:
                parsedChannelPath.guildId == "@me"
                  ? "Direct Message"
                  : `${referencedGuild.name} - #${referencedChannel.name}`,
              iconProxyURL: icon,
            },
          },
          renderLinkComponent: renderMaskedLinkComponent,
          renderDescription: () =>
            React.createElement(
              "div",
              {
                className: SearchResultClasses.message,
                key: referencedMessage.id,
              },
              React.createElement(ChannelMessage, {
                id: "message-link-preview-" + referencedMessage.id,
                message: referencedMessage,
                channel: referencedChannel,
                animateAvatar: false,
                subscribeToComponentDispatch: false,
                compact: UserSettingsStore.MessageDisplayCompact.getSetting(),
              })
            ),
        })
      );
    }

    return elements;
  }

  return null;
}
