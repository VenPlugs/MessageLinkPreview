const {getModule, React} = require("powercord/webpack");
const {inject, uninject} = require("powercord/injector");

const MessagePreviewAccessory = require("./MessagePreviewAccessory");

const {MessageAccessories} = getModule(["MessageAccessories"], false);


module.exports = class PowercordV3When extends require("powercord/entities").Plugin {
    startPlugin() {
      inject(
        "some bitches",
        MessageAccessories.prototype,
        "render",
        function (_, ret) {
          if (this?.props && ret?.props)
            ret.props.children.push(
              React.createElement(MessagePreviewAccessory, {
                message: this.props.message,
              })
            );
        }
      );
    }

    pluginWillUnload() {
      uninject("some bitches")
    }
}
