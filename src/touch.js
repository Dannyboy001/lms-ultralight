import { List as IList, Range, Set } from 'immutable'
import _ from 'lodash'
import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom'
import { List } from 'semantic-ui-react'

import './touch.styl'

export const SINGLE = "single"
export const TO_LAST = "to last"

/**
 * Touch-interactive list supporting selection and drag/drop
 *
 * Important props:
 * - items: `List` of items, which will be serialized in drag/drop
 *   operations. Each item in this list should correspond to a
 *   `TouchList.Item` with the same `index`.
 * - selection: `Set` of selected indexes. If not provided the selection
 *   will be maintained internally.
 * - dropTypes: Array of data types that can be dropped in this list.
 *   Dropping is not supported if this prop is not provided.
 * - onTap: Callback function handling tap on list item element
 *   with the class "tap-zone".
 *   event handling. Signature: `onTap(index, event)`
 * - onDrop: Callback function for handling dropped content.
 *   Signature: `onDrop(data, dataType, index, event)`
 * - onLongTouch: Callback function for handling long-touch event.
 *   Return `true` to also toggle item selection (the default action).
 *   Signature: `onLongTouch(item, index) -> bool`
 * - onMoveItems: Callback function for handling drag/drop movement
 *   (sorting) of items within the list. Sorting will be disabled if
 *   this prop is not provided.
 *   Signature: `onMoveItems(indexSet, toIndex)`
 * - onSelectionChanged: Callback function to handle selection changes.
 *   Signature: `onSelectionChanged(selection, isTouch)`
 */
export class TouchList extends React.Component {
  constructor(props) {
    super(props)
    this.id = _.uniqueId("touch-list-")
    this.state = {
      dropTypes: {},
      selection: props.selection || Set(),
      lastSelected: IList(),
    }
    this.slide = makeSlider(this)
  }
  componentDidMount() {
    this.slide.setTouchHandlers(ReactDOM.findDOMNode(this))
  }
  componentWillReceiveProps(props) {
    if (!props.items) {
      throw new Error("TouchList.props.items must be an indexed collection")
    }
    const dropTypes = _.zipObject(props.dropTypes)
    if (!_.isEqual(dropTypes, this.state.dropTypes)) {
      this.setState({dropTypes})
    }
    if (!this.props.items || !this.props.items.equals(props.items)) {
      // TODO option to preserve selection if items have been rearranged
      // This will be necessary for the playlist.
      this.selectionChanged(Set(), IList())
    }
    if (props.selection && !props.selection.equals(this.state.selection)) {
      this.setState({
        selection: props.selection,
        lastSelected: this.state.lastSelected
          .filter(index => props.selection.has(index))
      })
    }
  }
  componentWillUnmount() {
    this.slide.setTouchHandlers(null)
  }
  getChildContext() {
    return {
      TouchList_selection: this.state.selection,
      TouchList_onItemSelected: this.onItemSelected.bind(this),
      TouchList_slide: this.slide,
    }
  }
  getDragData(index) {
    const items = this.props.items
    let selected
    if (items.has(index)) {
      if (this.state.selection.has(index)) {
        selected = this.state.selection
          .valueSeq()
          .sort()
          .map(index => items.get(index).toObject())
          .toList()
      } else {
        selected = IList([items.get(index).toObject()])
      }
    } else {
      return []
    }
    return selected.toArray()
  }
  getAllowedDropType(possibleTypes) {
    const dropTypes = this.state.dropTypes
    return _.find(possibleTypes, value => dropTypes.hasOwnProperty(value))
  }
  onTap(index, event) {
    this.props.onTap && this.props.onTap(index, event)
  }
  onItemSelected(index, modifier, isTouch=false) {
    this.selectionChanged(({selection, lastSelected}) => {
      if (!modifier) {
        return {selection: Set([index]), lastSelected: IList([index])}
      }
      if (modifier === SINGLE) {
        if (!selection.has(index)) {
          selection = selection.add(index)
          lastSelected = lastSelected.push(index)
        } else {
          selection = selection.remove(index)
          if (lastSelected.last() === index) {
            lastSelected = lastSelected.pop()
          }
        }
      } else if (modifier === TO_LAST) {
        const from = lastSelected.last() || 0
        const step = from <= index ? 1 : -1
        selection = selection.union(Range(from, index + step, step))
        lastSelected = lastSelected.push(index)
      }
      return {selection, lastSelected}
    }, undefined, isTouch)
  }
  onLongTouch(index) {
    if (this.props.onLongTouch) {
      const item = this.props.items.get(index)
      if (this.props.onLongTouch(item && item.toObject(), index)) {
        this.toggleSelection(index, true)
      }
    } else {
      this.toggleSelection(index, true)
    }
  }
  toggleSelection(index, isTouch=false) {
    this.onItemSelected(index, SINGLE, isTouch)
  }
  clearSelection() {
    this.selectionChanged(Set(), IList())
  }
  selectionChanged(selection, lastSelected, isTouch=false) {
    if (_.isFunction(selection)) {
      this.setState((state, props) => {
        const func = props.onSelectionChanged
        const newState = selection(state)
        if (func && !newState.selection.equals(props.selection)) {
          func(newState.selection, isTouch)
        }
        // maybe broken: setState completes after onSelectionChanged
        return newState
      })
    } else {
      if (!selection.equals(this.state.selection)) {
        const func = this.props.onSelectionChanged
        this.setState({selection, lastSelected})
        if (func && !selection.equals(this.props.selection)) {
          func(selection, isTouch)
        }
      } else if (!lastSelected.equals(this.state.lastSelected)) {
        this.setState({lastSelected})
      }
    }
  }
  render() {
    const props = this.props
    const others = excludeKeys(props, TOUCHLIST_PROPS, "TouchList")
    others.className = "touchlist " + this.id
    if (props.className) {
      others.className += " " + props.className
    }
    return <List {...others}>{props.children}</List>
  }
}

TouchList.childContextTypes = {
  TouchList_selection: PropTypes.object.isRequired,
  TouchList_onItemSelected: PropTypes.func.isRequired,
  TouchList_slide: PropTypes.object.isRequired,
}

const TOUCHLIST_PROPS = {
  items: true,
  selection: true,
  children: true,
  dataType: true,
  dropTypes: true,
  onDrop: true,
  onLongTouch: true,
  onMoveItems: true,
  onSelectionChanged: true,
  onTap: true,
}

/**
 * Item component for TouchList
 *
 * Important props:
 * - index: required unique/consecutive index for this item.
 */
export class TouchListItem extends React.Component {
  constructor() {
    super()
    this.state = {selected: false, dropClass: null}
  }
  componentWillReceiveProps(props, context) {
    const index = props.index
    const selected = context.TouchList_selection.has(index)
    if (this.state.selected !== selected) {
      this.setState({selected})
    }
  }
  componentWillUnmount() {
    const slide = this.context.TouchList_slide
    slide && slide.removeItem(this.props.index, this)
  }
  clearDropIndicator() {
    if (this.state.dropClass !== null) {
      this.setState({dropClass: null})
    }
  }
  onDragOver(event, index, target) {
    const dropIndex = this.context.TouchList_slide.dragOver(event, index, target)
    const dropClass = index === dropIndex - 1 ? "dropAfter" :
                      index === dropIndex ? "dropBefore" : null
    if (this.state.dropClass !== dropClass) {
      this.setState({dropClass})
    }
  }
  onDrop(event, index) {
    this.clearDropIndicator()
    this.context.TouchList_slide.drop(event, index)
  }
  render() {
    const props = this.props
    if (!props.hasOwnProperty("index")) {
      throw new Error("`TouchList.Item` `props.index` is required")
    }
    const passProps = excludeKeys(props, TOUCHLISTITEM_PROPS, "TouchList.Item")
    const slide = this.context.TouchList_slide
    const index = props.index
    // this seems hacky, but can't think of any other way get touch events
    slide.addItem(index, this)
    if (!props.hasOwnProperty("onContextMenu")) {
      passProps.onContextMenu = event => event.preventDefault()
    }
    return <List.Item
        onClick={event => {
          const modifier = event.metaKey || event.ctrlKey ? SINGLE :
            (event.shiftKey ? TO_LAST : null)
          this.context.TouchList_onItemSelected(index, modifier)
        }}
        onDragStart={event => slide.dragStart(event, index)}
        onDragOver={event => this.onDragOver(event, index)}
        onDrop={event => this.onDrop(event, index)}
        onDragLeave={this.clearDropIndicator.bind(this)}
        onDragEnd={this.clearDropIndicator.bind(this)}
        data-touchlist-item-index={index}
        className={_.filter([
          "touchlist-item",
          this.state.selected ? "selected" : "",
          this.state.dropClass,
          props.className
        ]).join(" ")}
        draggable
        {...passProps}>
      {props.children}
    </List.Item>
  }
}

const TOUCHLISTITEM_PROPS = {
  index: true,
  children: true,
  onClick: false,
  onDragStart: false,
  onDragOver: false,
  onDrop: false,
  onDragEnd: false,
  className: true,
  "data-touchlist-item-index": false,
}

TouchList.Item = TouchListItem

TouchListItem.contextTypes = {
  TouchList_selection: PropTypes.object.isRequired,
  TouchList_onItemSelected: PropTypes.func.isRequired,
  TouchList_slide: PropTypes.object.isRequired,
}

/**
 * Create a new object excluding keys from the source object
 *
 * @param src - The source object.
 * @param keys - An object whose members should be excluded. An error
 *    will be thrown if any value returned by `_.get(keys, key)` returns
 *    a falsy value and the source object has such a key.
 */
const excludeKeys = (src, keys, for_) => _.pickBy(src, (value, key) => {
  if (!_.has(keys, key)) {
    return true
  } else if (!_.get(keys, key)) {
    throw new Error("cannot override " + for_ + " " + key)
  }
}, {})

/**
 * List touch interaction and drag/drop manager
 *
 * Mouse interaction
 *  - click to select
 *  - ctrl/shift+click to select/deselect multiple
 *  - drag/drop to rearrange items in list (if onMoveItems provided)
 *
 * Touch interaction:
 *  - tappable reigions (class="tap-zone")
 *    - event prop: onTap={callback}
 *  - tap to select and enter selection/reorder mode
 *    - tap to select/deselect items
 *      - event prop: onSelect
 *        - returns: boolean - true to enter multi-select mode
 *    - drag on drag handle to rearrange items in list
 *    - long-press+drag to select and rearrange item(s) in list
 *    - long-press selected item to exit selection mode
 *    - tap/deselect last selected item to exit selection mode
 *  - TODO swipe to enter delete mode
 *    - click delete icon on right to confirm deletion
 *  - TODO long-press to view track details
 */
function makeSlider(touchlist) {
  const items = {}
  let listeners = []
  let holdTimer = null
  let isHolding = false
  let isTouchDrag = false
  let startPosition = null
  let latestPosition = null
  let startIndex = null
  let latestIndex = null

  function setTouchHandlers(el) {
    if (el) {
      listeners = [
        addEventListener(el, 'touchstart', touchStart),
        addEventListener(el, 'touchmove', touchMove, {passive: false}),
        addEventListener(el, 'touchend', touchEnd),
      ]
    } else {
      while (listeners.length) { listeners.pop()() }
    }
  }
  function addEventListener(el, name, handler, options) {
    el.addEventListener(name, handler, options)
    return () => el.removeEventListener(name, handler, options)
  } 

  function addItem(index, item) {
    items[index] = item
  }
  function removeItem(index, item) {
    if (items[index] === item) {
      delete items[index]
    }
  }
  function touchStart(event) {
    if (event.touches.length > 1) {
      return
    }
    const pos = startPosition = latestPosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: event.timeStamp,
    }
    const target = getTarget(pos)
    const index = getIndex(target)
    const isSelected = touchlist.state.selection.has(index)
    if (touchlist.props.onMoveItems) {
      event.target.dataset.touchlistId = touchlist.id
      startIndex = index
    }
    if (touchlist.props.dataType) {
      const data = touchlist.getDragData(index)
      event.target.dataset.touchlistDragType = touchlist.props.dataType
      event.target.dataset.touchlistDragData = JSON.stringify(data)
    }
    isHolding = false
    isTouchDrag = hasClass(target, "drag-handle")
    holdTimer = setTimeout(() => {
      isHolding = true
      if (startPosition === latestPosition && !isTouchDrag) {
        if (isSelected && touchlist.state.selection.size) {
          touchlist.clearSelection()
          isHolding = false
          latestPosition = null  // do nothing on touchEnd
        } else {
          isTouchDrag = true
          touchlist.onLongTouch(index)
        }
      }
    }, 300)
  }
  function touchMove(event) {
    cancelHold()
    const pos = latestPosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: event.timeStamp,
    }
    const target = getTarget(pos)
    if (isTouchDrag) {
      const index = getIndex(target)
      event.preventDefault()
      if (index !== latestIndex && items.hasOwnProperty(latestIndex)) {
        items[latestIndex].clearDropIndicator()
      }
      latestIndex = index
      if (index !== null && items.hasOwnProperty(index)) {
        items[index].onDragOver(event, index, target)
      }
    }
  }
  function touchEnd(event) {
    if (!latestPosition) {
      return  // hold selected -> clear selection
    }
    const target = getTarget(latestPosition)
    let index
    if (!isHolding && startPosition === latestPosition) {
      index = getIndex(target)
      if (hasClass(target, "tap-zone")) {
        touchlist.onTap(index, event)
      } else {
        event.preventDefault()
        touchlist.toggleSelection(index, true)
      }
    } else if (touchlist.state.selection.size) {
      index = getIndex(target)
      if (index !== null) {
        const toIndex = allowedDropIndex(event, index, target)
        if (toIndex >= 0) {
          event.preventDefault()
          drop(event, index)
        }
      }
    }
    delete event.target.dataset.touchlistId
    delete event.target.dataset.touchlistDragType
    delete event.target.dataset.touchlistDragData
    if (items.hasOwnProperty(latestIndex) ) {
      items[latestIndex].clearDropIndicator()
      latestIndex = null
    }
    isTouchDrag = false
    cancelHold()
  }
  function cancelHold() {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  }
  function getTarget(pos) {
    return document.elementFromPoint(pos.x, pos.y)
  }
  function getIndex(el) {
    while (el && el.parentNode) {
      if ("touchlistItemIndex" in el.dataset) {
        return parseInt(el.dataset.touchlistItemIndex)
      }
      if (el.classList.contains(touchlist.id)) {
        break // TODO get index (0 or last index) depending on pos.y
      }
      el = el.parentNode
    }
    return null
  }
  function getDataTypes(event) {
    if (event.dataTransfer) {
      // drag/drop event
      return event.dataTransfer.types
    }
    // touch event
    const dataset = event.target.dataset
    const types = [dataset.touchlistId]
    if (dataset.touchlistDragType) {
      return types.push(dataset.touchlistDragType)
    }
    return types
  }
  function getData(event, dataTypes) {
    const dropType = touchlist.getAllowedDropType(dataTypes)
    let data = null
    if (event.dataTransfer) {
      // drag/drop event
      data = event.dataTransfer.getData(dropType)
    } else if (dropType === event.target.dataset.touchlistDragType) {
      // touch event
      data = event.target.dataset.touchlistDragData
    }
    return [data && JSON.parse(data), dropType]
  }
  function getMoveIndex(event, dataTypes) {
    if (touchlist.props.onMoveItems && dataTypes.indexOf(touchlist.id) !== -1) {
      // use touchlist because dragOver events do not allow access to the data
      return startIndex
    }
    return null
  }
  function hasClass(el, className) {
    while (el) {
      if (el.classList && el.classList.contains(className)) {
        return true
      }
      el = el.parentNode
    }
    return false
  }
  function allowedDropIndex(event, index, target=event.currentTarget) {
    const dataTypes = getDataTypes(event)
    const moveIndex = getMoveIndex(event, dataTypes)
    const dropIndex = getDropIndex(event, index, target)
    if (moveIndex === null) {
      return touchlist.getAllowedDropType(dataTypes) ? dropIndex : -1
    }
    const sel = touchlist.state.selection
    if (sel.has(moveIndex)) {
      if (!(sel.has(dropIndex) || sel.has(dropIndex - 1))) {
        return dropIndex
      }
    } else if (dropIndex !== moveIndex && dropIndex !== moveIndex + 1) {
      return dropIndex
    }
    return -1
  }
  function getDropIndex(event, index, target=event.currentTarget) {
    const a = event.clientY - target.offsetTop
    const b = target.offsetHeight / 2
    return a > b ? index + 1 : index
  }
  function dragStart(event, index) {
    const mayMove = touchlist.props.onMoveItems
    if (mayMove) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData(touchlist.id, "")
      startIndex = index
    }
    if (touchlist.props.dataType) {
      const data = JSON.stringify(touchlist.getDragData(index))
      event.dataTransfer.setData(touchlist.props.dataType, data)
      event.dataTransfer.effectAllowed = mayMove ? "copyMove" : "copy"
    }
  }
  function dragOver(event, index, target) {
    const dropIndex = allowedDropIndex(event, index, target)
    if (dropIndex >= 0) {
      event.preventDefault()
    }
    return dropIndex
  }
  function drop(event, index) {
    const dropIndex = getDropIndex(event, index)
    if (dropIndex >= 0) {
      const dataTypes = getDataTypes(event)
      const moveIndex = getMoveIndex(event, dataTypes)
      if (moveIndex !== null) {
        let selection = touchlist.state.selection
        if (!selection.has(moveIndex)) {
          selection = Set([moveIndex])
        }
        touchlist.props.onMoveItems(selection, dropIndex)
      } else if (touchlist.props.onDrop) {
        touchlist.props.onDrop(...getData(event, dataTypes), dropIndex, event)
      }
    }
  }

  return {
    addItem,
    removeItem,
    setTouchHandlers,
    dragStart,
    dragOver,
    drop,
  }
}
