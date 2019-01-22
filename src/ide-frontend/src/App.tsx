import * as React from "react";

import AceEditor from "react-ace";
import { Canvas, Packets } from "react-renderer";
import { Grid, Cell } from "styled-css-grid";
import logo from "./icons/logo.svg";
import venn from "./icons/venn.svg";
import playWhite from "./icons/play-white.svg";
import hammer from "./icons/hammer.svg";
import reload from "./icons/reload.svg";
import Checkmark from "./icons/checkmark";
import popout from "./icons/popout.svg";
import chevronDown from "./icons/chevron_down.svg";
import download from "./icons/download.svg";
import Log from "Log";
import Button from "Button";
import Dropdown, { IOption } from "Dropdown";
import { Menu, MenuList, MenuButton, MenuItem } from "@reach/menu-button";
import { Persist } from "react-persist";
import Alert from "@reach/alert";
import styled from "styled-components";
import { COLORS } from "./styles";
import Inspector from "./Inspector";
const socketAddress = "ws://localhost:9160";

/*
  DEBUG NOTES:
    If you don't want the localStorage to set text box contents,
    remove the <Persist> Element
*/

const MenuBtn = styled(MenuButton)`
  background: none;
  border: none;
  opacity: 0.8;
  transition: 0.2s;
  cursor: pointer;
  :hover {
    opacity: 1;
    transition: 0.2s;
  }
  :focus {
    outline: none;
    opacity: 1;
  }
`;

const SocketAlert = styled(Alert)`
  background-color: hsla(10, 50%, 50%, 0.3);
  padding: 0.5em;
  position: absolute;
  width: 100%;
  box-sizing: border-box;
`;
const ConvergedStatus = styled(Alert)`
  background: rgba(0, 0, 0, 0.07);
  padding: 0.5em;
  box-sizing: border-box;
  position: absolute;
  width: 100%;
`;
const ErrorContainer = styled.div`
  position: relative;
`;

const CodeError = styled(Alert)`
  background-color: hsla(202, 92%, 61%, 0.3);
  padding: 0.5em;
  width: inherit;
  position: absolute;
  bottom: 0;
  font-size: 1em;
`;

const ButtonWell = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.5em;
  padding-bottom: 1em;
  box-sizing: border-box;
  flex-grow: 0;
  flex-shrink: 0;
`;

const DebugButtonBox = styled.div`
  display: flex;
  align-items: center;
`;

interface ISettings {
  debug: boolean;
  playOnBuild: boolean;
}

interface IState {
  code: string;
  initialCode: string;
  rendered: boolean;
  selectedElement: IOption;
  selectedStyle: IOption;
  settings: ISettings;
  socketReady: boolean;
  socketError: string;
  codeError: string;
  converged: boolean;
  autostep: boolean;
  showInspector: boolean;
}

const elementOptions = [
  { value: 0, label: "set theory", icon: venn },
  { value: 1, label: "linear algebra", icon: logo },
  { value: 2, label: "real analysis", icon: logo }
];

const styleOptions = [{ value: 0, label: "venn", icon: venn }];
class App extends React.Component<any, IState> {
  public state = {
    code: "AutoLabel All\n",
    initialCode: "AutoLabel All\n",
    rendered: false,
    selectedElement: elementOptions[0],
    selectedStyle: styleOptions[0],
    settings: {
      debug: false,
      playOnBuild: true
    },
    socketReady: false,
    socketError: "",
    codeError: "",
    converged: true,
    autostep: false,
    showInspector: false
  };
  public ws: any = null;
  public readonly renderer = React.createRef<Canvas>();
  constructor(props: any) {
    super(props);
    Log.info("Connecting to socket...");
    this.setupSockets();
  }
  public download = () => {
    if (this.renderer.current !== null) {
      this.renderer.current.download();
    }
  };
  public autostep = async () => {
    this.setState({
      autostep: !this.state.autostep
    });
    this.sendPacket(Packets.autoStepToggle());
  };
  public sendPacket = (packet: string) => {
    this.ws.send(packet);
  };
  public step = () => {
    this.sendPacket(Packets.step());
  };
  public toggleInspector = () => {
    this.setState({showInspector: !this.state.showInspector});
  };
  public resample = () => {
    this.sendPacket(Packets.resample());
  };
  public onSocketError = (e: any) => {
    this.setState({ socketError: "Error: could not connect to WebSocket." });
    Log.error(`Could not connect to websocket: ${e}`)
  };
  public clearSocketError = () => {
    this.setState({ socketError: "", socketReady: true });
  };
  public setupSockets = () => {
    this.ws = new WebSocket(socketAddress);
    this.ws.onopen = this.clearSocketError;
    this.ws.onmessage = this.onMessage;
    this.ws.onclose = (e: any) => {
      this.onSocketError(e);
      this.setupSockets();
    };
    this.ws.onerror = this.onSocketError;
  };
  public onMessage = (e: MessageEvent) => {
    if (this.renderer.current !== null) {
      const data = JSON.parse(e.data);
      const packetType = data.type;
      Log.info("Received data from the server.", data);
      // If no error, clear error box
      if (packetType !== "error") {
        if (this.state.codeError !== "") {
          this.setState({ codeError: "" });
        }
        if (!this.state.rendered) {
          this.setState({ rendered: true });
        }
      }
      // If error, show error popup
      if (packetType === "error") {
        Log.error(data);
        this.setState({ codeError: data.contents.contents });
      } else if (packetType === "shapes") {
        // Otherwise, send the packet to the renderer
        this.renderer.current.onMessage(e);
        const { flag } = data.contents;
        // Rough inference of whether the diagram converged
        const converged = flag === "initial" || flag === "final";
        if (this.state.converged !== converged) {
          this.setState({ converged });
        }
      } else {
        Log.error(`Unknown packet type: ${packetType}`);
      }
    } else {
      Log.error("Renderer is null.");
    }
  };
  public compile = async () => {
    const packet = { tag: "Edit", contents: { program: this.state.code } };

    await this.ws.send(JSON.stringify(packet));
    await this.setState({ initialCode: this.state.code, autostep: false });
  };
  public compileAndRun = async () => {
    await this.compile();
    // TODO: send autostep jointly with compile packet so there are no jumpy behaviors
    await this.autostep();
  };
  public onChangeCode = (value: string) => {
    this.setState({ code: value });
  };
  public selectedElement = (value: IOption) => {
    this.setState({ selectedElement: value });
  };
  public selectedStyle = (value: IOption) => {
    this.setState({ selectedStyle: value });
  };
  public toggleSetting = (setting: string) => () => {
    const settings = {
      ...this.state.settings,
      [setting]: !this.state.settings[setting]
    };
    this.setState({ settings });
  };
  public render() {
    const {
      code,
      initialCode,
      rendered,
      selectedElement,
      selectedStyle,
      settings,
      socketError,
      codeError,
      socketReady,
      converged,
      autostep,
      showInspector
    } = this.state;
    const busy = !converged && autostep;
    // TODO: split panes into individual files after merge (renderingPane, editingPane, etc)
    return (
      <Grid
        style={{
          height: "100vh",
          backgroundColor: "#EDF8FF"
        }}
        columns={2}
        rows="70px minmax(0px,auto)"
        gap="0"
        rowGap="0"
        columnGap={"5px"}
      >
        <Inspector show={showInspector}/>
        <Persist
          name="ideSettings"
          data={settings}
          debounce={0}
          onMount={data => this.setState({ settings: data })}
        />
        <Persist
          name="savedContents"
          data={code}
          debounce={200}
          onMount={data => this.setState({ code: data })}
        />
        <Cell
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            padding: "0 0.2em 0 0.5em"
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Menu>
              <MenuBtn>
                <img src={logo} width={50} aria-labelledby="Main Menu" />
                <img src={chevronDown} />
              </MenuBtn>
              <MenuList>
                <MenuItem onSelect={this.toggleSetting("playOnBuild")}>
                  {settings.playOnBuild && <Checkmark color={COLORS.primary}/>}{" "}
                  Play on Build
                </MenuItem>
                <MenuItem onSelect={this.toggleSetting("debug")}>
                  {settings.debug && <Checkmark color={COLORS.primary}/>} Debug
                  Mode
                </MenuItem>
              </MenuList>
            </Menu>

            <Dropdown
              options={elementOptions}
              selected={selectedElement}
              onSelect={this.selectedElement}
            />
          </div>
          <Button
            label={settings.playOnBuild ? "play" : "build"}
            leftIcon={settings.playOnBuild ? playWhite : hammer}
            onClick={settings.playOnBuild ? this.compileAndRun : this.compile}
            primary={true}
            disabled={!socketReady || busy || code === initialCode}
          />
        </Cell>
        <Cell
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            padding: "0 0.2em 0 0.5em"
          }}
        >
          <Dropdown
            options={styleOptions}
            selected={selectedStyle}
            onSelect={this.selectedStyle}
          />
          {settings.debug && (
            <DebugButtonBox>
              <Button label="step" onClick={this.step}/>
              <Button
                label={"inspector"}
                onClick={this.toggleInspector}
                leftIcon={popout}
              />
            </DebugButtonBox>
          )}
        </Cell>
        <Cell>
          <AceEditor
            width="100%"
            height="100%"
            style={{ zIndex: 0 }}
            fontSize={20}
            onChange={this.onChangeCode}
            value={code}
          />
          {codeError !== "" && (
            <div style={{ position: "relative" }}>
              <CodeError>{codeError}</CodeError>
            </div>
          )}
        </Cell>
        <Cell
          style={{
            backgroundColor: "#FBFBFB"
          }}
        >
          <div style={{ height: "100%", display: "flex", flexFlow: "column" }}>
            <ErrorContainer>
              {socketError !== "" && <SocketAlert>{socketError}</SocketAlert>}

              {busy && <ConvergedStatus>optimizing...</ConvergedStatus>}
            </ErrorContainer>
            <div
              style={{
                flexGrow: 1,
                flexShrink: 1,
                overflowY: "auto"
              }}
            >
              <Canvas
                ref={this.renderer}
                lock={busy}
                sendPacket={this.sendPacket}
              />
            </div>
            <ButtonWell>
              <Button
                label="resample"
                leftIcon={reload}
                onClick={this.resample}
                primary={true}
                disabled={!rendered || busy}
              />
              <Button
                label={autostep ? "autostep (on)" : "autostep (off)"}
                onClick={this.autostep}
              />
              <Button
                leftIcon={download}
                label="download"
                onClick={this.download}
                disabled={!rendered}
              />
            </ButtonWell>
          </div>
        </Cell>
      </Grid>
    );
  }
}

export default App;
