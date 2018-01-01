import React from 'react'
import { Link, Route, Switch } from 'react-router-dom'
import { Icon, Menu, Message, Responsive, Sidebar, Transition } from 'semantic-ui-react'

import * as players from './playerselect'
import { MediaSearch } from './search'
import './menu.styl'

export const MainMenuUI = props => (
  <div className="mainmenu">
    <PowerBar {...props} />
    <Transition
        visible={!!props.messages.error}
        animation="slide down"
        duration={500}
        unmountOnHide>
      <Message
          className="messages"
          onDismiss={props.onHideError}
          onClick={props.onHideError}
          size="small"
          negative>
        <Message.Content>
          <Icon name="warning" size="large" />
          {props.messages.error}
        </Message.Content>
      </Message>
    </Transition>
    <Responsive minWidth={500}>
      <Route path="/menu" children={({match: menuOpen}) => (
        <Sidebar
            as="div"
            className="sidebar"
            animation="push"
            width="wide"
            visible={!!menuOpen}>
          <MenuItems {...props} />
        </Sidebar>
      )} />
      <Sidebar.Pusher>
        <MainView {...props} />
      </Sidebar.Pusher>
    </Responsive>
    <Responsive maxWidth={500}>
      <Switch>
        <Route path="/menu" render={() => <MenuItems {...props} />} />
        <Route render={() => <MainView {...props} />} />
      </Switch>
    </Responsive>
  </div>
)

const MenuItems = props => (
  <Menu borderless fluid vertical className="menu-items">
    <Menu.Item name="search">
      <MediaSearch {...props} basePath="/menu" />
    </Menu.Item>
  </Menu>
)

const MainView = props => (
  <div className="mainview ui grid">
    <div className="sixteen wide column">
      {props.children}
    </div>
  </div>
)

const PowerBar = props => {
  const player = props.player.toObject()
  return <Route path="/menu" children={({match: menuOpen}) => (
    <Menu className="power-bar" fixed="top" borderless>
      <Link to={ menuOpen ? "/" : "/menu" }>
        <Menu.Item>
          <Icon name="content" size="large" />
        </Menu.Item>
      </Link>
      { player.isControlVisible && !menuOpen ?
        <Menu.Item fitted>
          <players.SelectPlayer
            playerid={player.playerid}
            onPlayerSelected={props.onPlayerSelected}
            dispatch={props.dispatch}
            {...props.players.toObject()} />
        </Menu.Item> :
        <PlayGroup
          playctl={props.playctl}
          isPlaying={player.isPlaying} />
      }
      {player.isControlVisible && !menuOpen ?
        <Menu.Menu position="right">
          <Menu.Item
              fitted="vertically"
              active={player.isPowerOn}
              onClick={props.playctl.togglePower}
              disabled={!player.playerid}>
            <Icon name="power" size="large" />
          </Menu.Item>
        </Menu.Menu> :
        <VolumeGroup playctl={props.playctl} />
      }
    </Menu>
  )} />
}

const PlayGroup = props => {
  const playctl = props.playctl
  return <Menu.Menu position={props.position} icon>
    <Menu.Item
        onClick={() => playctl.command("playlist", "index", "-1")}
        disabled={!playctl.playerid}
        fitted>
      <Icon size="large" name="backward" />
    </Menu.Item>
    <Menu.Item
        onClick={() => playctl.command(props.isPlaying ? "pause" : "play")}
        disabled={!playctl.playerid}
        fitted="vertically">
      <Icon size="large" name={props.isPlaying ? "pause" : "play"} />
    </Menu.Item>
    <Menu.Item
        onClick={() => playctl.command("playlist", "index", "+1")}
        disabled={!playctl.playerid}
        fitted>
      <Icon size="large" name="forward" />
    </Menu.Item>
  </Menu.Menu>
}

const VolumeGroup = ({playctl}) => {
  return <Menu.Menu position="right" icon>
    <Menu.Item
        onClick={() => playctl.command("mixer", "volume", "-5")}
        disabled={!playctl.playerid}
        fitted="vertically">
      <Icon size="large" name="volume down" />
    </Menu.Item>
    <Menu.Item
        onClick={() => playctl.command("mixer", "volume", "+5")}
        disabled={!playctl.playerid}
        fitted="vertically">
      <Icon size="large" name="volume up" />
    </Menu.Item>
  </Menu.Menu>
}
