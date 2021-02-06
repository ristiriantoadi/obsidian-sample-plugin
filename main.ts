import { CONNREFUSED } from 'dns';
import {Plugin,MarkdownView, TFile} from 'obsidian';
import { start } from 'repl';
import YAML from 'yaml'
import {IBlockMetadata} from "block-metadata"
import { listeners } from 'process';

export default class MyPlugin extends Plugin {

	globalTimeOut:any=null
	modifiedThroughPlugin=false
	blockMetadata:IBlockMetadata[] = new Array()
	data:string
	currentFile:TFile
	lastCursorPosition = new CodeMirror.Pos(0,0)
	cm:CodeMirror.Editor
	lastLineLength:number=1
	linesChanged:number=0
	firstChange=false

	
	formatDate(date:Date):string{
		var getYear:string = date.getFullYear().toString();
        var getMonth:string = date.getMonth()+1 < 10 ? `0${date.getMonth()+1}`:`${date.getMonth()+1}`;	
        var getDate:string = date.getDate() < 10 ? `0${date.getDate()}`:`${date.getDate()}`
		var getHour:string = date.getHours()< 10 ? `0${date.getHours()}`:`${date.getHours()}`
		var getMinute:string = date.getMinutes()< 10 ? `0${date.getMinutes()}`:`${date.getMinutes()}`
		var getSecond:string = date.getSeconds()< 10 ? `0${date.getSeconds()}`:`${date.getSeconds()}`
		return  `${getYear}-${getMonth}-${getDate} ${getHour}:${getMinute}:${getSecond}`
	}
	
	generateUniqueBlockId(){
		return '^' + Math.random().toString(36).substr(2, 9);
	}
	
	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):number{
		const cursorLine = cm.getCursor().line
		const lines = this.data.split("\n")
		//get start of block
		var currentLine = cursorLine;
		var startLineOfCurrentBlock = currentLine;
		while(currentLine>=0){
			if(lines[currentLine] == '' && currentLine != cursorLine)
				break
			// if(lines[currentLine] == "")
			// 	break
			if(lines[currentLine] == '---')
				break
			if(lines[currentLine] == "```")
				break
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		return startLineOfCurrentBlock;
	}

	getEndLineOfCurrentBlock(cm:CodeMirror.Editor){
		const cursorLine = cm.getCursor().line
		const lines = this.data.split("\n")
		//get end of block
		var currentLine = cursorLine;
		var endLineOfCurrentBlock = currentLine;
		while(currentLine<lines.length){
			// if(lines[currentLine] == '' && currentLine != cursorLine)
			// 	break
			endLineOfCurrentBlock=currentLine;
			if(lines[currentLine] == "")
				break
			if(lines[currentLine] == '---')
				break
			if(lines[currentLine].startsWith("```"))
				break
			currentLine++;
		}
		return endLineOfCurrentBlock;
	}

	createNewBlock(yamlObject:any,changeTime:string,lines:string[],startLineOfCurrentBlock:number,cm:CodeMirror.Editor,currentFile:TFile,co:CodeMirror.EditorChangeLinkedList){
		console.log("create new block")
		var blockId = this.generateUniqueBlockId()
		var noYaml=false
		var noBlockTimestamp=false
		if(yamlObject == undefined || yamlObject == null){
			yamlObject = new Object()
			noYaml=true;
		}
		if(yamlObject.blockTimestamp == undefined || 
			yamlObject.blockTimestamp == null){
			noBlockTimestamp=true
			yamlObject.blockTimestamp = new Array()
		}
		yamlObject.blockTimestamp.push({id:blockId,created:changeTime,modified:changeTime})
		var newContent=""
		for(var n = 0;n<lines.length;n++){
			if(n == startLineOfCurrentBlock){
				newContent+=blockId+"\n"
			}
			newContent+=lines[n]+"\n";
		}
		var yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
		if(!noYaml){
			//replace yaml front matter if it exist
			newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
		}
		else{
			//prepend metadata to content
			newContent = "---\n"+yamlString+"---\n"+newContent
		}
		this.modifiedThroughPlugin=true
		const cursorPos = cm.getCursor()
		this.app.vault.modify(currentFile,newContent).then(()=>{
			//update cursor position
			var addedNewContentLength = 4//1 for the new block id in the content, 3 for metadata timestamp in the yaml 
			if(noYaml){
				addedNewContentLength += 2 // for the closing and opening line of the metadata
			}
			if(noBlockTimestamp){
				addedNewContentLength +=1 //for the blocktimestamp key
			}
			cursorPos.line +=(addedNewContentLength)
			cm.setCursor(cursorPos)
		})
	}

	updateBlock(yamlObject:any,changeTime:string,startLineOfCurrentBlock:number,lines:string[],currentFile:TFile,cm:CodeMirror.Editor,co:CodeMirror.EditorChangeLinkedList){
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				console.log("update a block")
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.map((b:any)=>{
					if(b.id == lines[startLineOfCurrentBlock]){
						b.modified=changeTime
					}
					return b
				})
				var yamlString = YAML.stringify(yamlObject)
				var newContent = lines.join("\n")
				newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
				this.modifiedThroughPlugin=true
				//update cursor pos
				const cursorPos = cm.getCursor()
				console.log(cursorPos)
				this.app.vault.modify(currentFile,newContent).then(()=>{
					cm.setCursor(cursorPos)
				}) 
			}
		}
	}

	removeBlock(startLineOfCurrentBlock:number,lines:string[],yamlObject:any,currentFile:TFile,cm:CodeMirror.Editor,id:string,blockIdDeleted:boolean,co:CodeMirror.EditorChangeLinkedList){
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				console.log("remove a block")
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.filter((b:any)=>{
					if(b.id != id)
						return b;
				})
				//update the new content
				var newContent=""
				if(blockIdDeleted){
					newContent=lines.join("\n")
				}else{
					for(var n = 0;n<lines.length;n++){
						if(n != startLineOfCurrentBlock){
							newContent+=lines[n]+"\n";	
						}
					}
				}
				//update the metadata
				var yamlString = YAML.stringify(yamlObject)
				newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
				//update cursor position
				const position = cm.getCursor()
				var removedLines=4
				if(blockIdDeleted)
					removedLines=3
				position.line -=removedLines
				this.modifiedThroughPlugin=true
				this.app.vault.modify(currentFile,newContent).then(()=>{
					cm.setCursor(position) 

				})
			}
		}
	}

	isBlockExist(blockId:string){
		const lines = this.data.split("\n")
		for(var n = 0;n<lines.length;n++){
			if(lines[n] == blockId){
				//check the line below the matched line
				//if it's not an empty line then the block still exist 
				if(lines[n] != ''){
					return true
				}
			}
		}
		return false
	}

	removeBlockIdentifier(blockId:string){
		const lines = this.data.split("\n")
		var newContent=""
		for(var n=0;n<lines.length;n++){
			if(lines[n] != blockId){
				newContent+=lines[n]+"\n"
			}else{
				this.updateTempMetadata(n,-1)
				this.linesChanged+=-1
			}
		}
		this.data = newContent
	}

	isBlockMetadataStillValid(bm:any){
		//check if the bm still valid
		const lines = this.data.split("\n")
		for(var n = 0;n<lines.length;n++){
			if(lines[n] == bm.firstLineofBlock && n==bm.lineNumber){
				if(n == 0 || (n>0 && lines[n-1] == ''))
					return true
			}
		}
		return false;
	}

	cleanMetadata(){
		//clean the metadata from non-existing block
		//get yaml as object
		var metadata = this.data.match(/(---)(.*)(---)/s);
		var yamlString = ""
		if(metadata){
			yamlString = metadata[0].match(/(?<=---\n)(.*)(?=\n---)/s)[0];
		}
		var yamlObject = YAML.parse(yamlString)
		//run through each blocktimestamp element and check if that block still exist
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.filter((b:any)=>{
					const blockId=b.id
					if(this.isBlockExist(blockId)){
						return b
					}else{
						//remove the block identifier
						//if the block identifier still exist in the content
						this.removeBlockIdentifier(blockId)//this change this.data
						this.linesChanged+=-3
					}
				})
			}
		}
		return yamlObject
	}

	updateYamlObject(yamlObject:any){
		this.blockMetadata.forEach(bm=>{
			//check if the bm still valid
			if(this.isBlockMetadataStillValid(bm)){//this use line number
				//new block
				if(!bm.firstLineofBlock.startsWith("^")){
					if(yamlObject == null || yamlObject == undefined){
						yamlObject = new Object()
						this.linesChanged+=2					
					}
					if(yamlObject.blockTimestamp == null || yamlObject.blockTimestamp == undefined){
						yamlObject.blockTimestamp = new Array()
						this.linesChanged+=1
					}
					//generate new block id and append it to the start of the block
					var blockId = this.generateUniqueBlockId()
					const lines = this.data.split("\n")
					var blockLine=bm.lineNumber
					yamlObject.blockTimestamp.push({
						id:blockId,
						created:bm.timestamp,
						modified:bm.timestamp
					})
					this.linesChanged+=3
					var newContent=""
					for(var n = 0;n<lines.length;n++){
						if(n == blockLine){
							newContent+=blockId+"\n"
							this.updateTempMetadata(n,1)
							this.linesChanged+=1
						}
						newContent+=lines[n]+"\n";
					}
					this.data = newContent
				}else{
					if(yamlObject){
						if(yamlObject.blockTimestamp){
							yamlObject.blockTimestamp = yamlObject.blockTimestamp.map((bt:any)=>{
								if(bt.id == bm.firstLineofBlock){
									bt.modified=bm.timestamp
								}
								return bt
							})
						}
					}
				}
			}
		})
		return yamlObject
	}

	updateDoc(currentFile:TFile){
		//update yaml and the content
		//get yaml as object
		var metadata = this.data.match(/(---)(.*)(---)/s);
		var yamlString = ""
		if(metadata){
			yamlString = metadata[0].match(/(?<=---\n)(.*)(?=\n---)/s)[0];
		}
		var yamlObject = YAML.parse(yamlString)
		var noYaml=true
		if(yamlObject){	
			noYaml=false
		}
		yamlObject = this.updateYamlObject(yamlObject)//this change this.data, this use linenumber
		yamlObject=this.cleanMetadata()//this change this.data
		//update the content
		var yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
		if(!noYaml){
			//replace yaml front matter if it exist
			this.data = this.data.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
		}
		else{
			//prepend metadata to content
			this.data = "---\n"+yamlString+"---\n"+this.data
		}
		this.modifiedThroughPlugin=true
		//update cursor position
		const cursorPos = this.cm.getCursor()
		cursorPos.line += this.linesChanged
		this.app.vault.modify(currentFile,this.data).then(()=>{
			//set cursor
			this.cm.setCursor(cursorPos)
			this.linesChanged=0
			this.blockMetadata = new Array()
		})
	}

	updateTempMetadata(lineOrigin:number,different:number){
		if(this.blockMetadata){
			this.blockMetadata = this.blockMetadata.map(bm=>{
				if(bm.lineNumber>=lineOrigin){
					bm.lineNumber+=different
				}
				return bm
			})
		}
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');
		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			this.cm=cm
			this.lastLineLength=cm.getValue().split("\n").length
			cm.on("cursorActivity",(cm)=>{
				this.lastCursorPosition = cm.getCursor()
			})

			cm.on("change",(cm,co)=>{
				this.data = cm.getValue()
				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const lines = this.data.split("\n")
				var currentLength = lines.length

				if(this.modifiedThroughPlugin){
					this.modifiedThroughPlugin=false;
					this.lastCursorPosition = cm.getCursor()
					this.lastLineLength=currentLength
					return
				}

				//check if doc length change
				//update tempMetadata if so
				var different =currentLength - this.lastLineLength
				console.log("different",different)
				if(different != 0){
					var lineOrigin
					if(co.origin=="+delete"){
						lineOrigin = co.from
					}else{
						lineOrigin = this.lastCursorPosition
					}
					if(lineOrigin.ch>0){
						lineOrigin.line+=1
					}
					this.updateTempMetadata(lineOrigin.line,different)
				}

				//check if a character is changed
				//or user simply press enter or delete
				//empty character, return
				var characterChanged=false
				co.removed.forEach(c=>{
					if(c != ""){
						characterChanged=true
					}
				})
				co.text.forEach(c=>{
					if(c!=""){
						characterChanged=true
					}
				})
				if(!characterChanged){
					this.lastCursorPosition = cm.getCursor()
					this.lastLineLength=currentLength
					return
				}

				//cursor is in the metadata, return
				if(startLineOfCurrentBlock == 0 && lines[startLineOfCurrentBlock].startsWith("---")){
					this.lastCursorPosition = cm.getCursor()
					this.lastLineLength=currentLength
					return;
				}

				//user removed a block
				if(lines[startLineOfCurrentBlock] == '' && co.origin=="+delete"){
					this.lastCursorPosition = cm.getCursor()
					this.lastLineLength=currentLength
					return;
				}
				
				//update temp metadata
				var blockExist=false
				this.blockMetadata = this.blockMetadata.map(bm=>{
					if(bm.firstLineofBlock == lines[startLineOfCurrentBlock] && bm.lineNumber == startLineOfCurrentBlock){
						// bm.firstLineofBlock=lines[startLineOfCurrentBlock]
						bm.timestamp = changeTime
						blockExist=true
					}
					return bm
				})
				if(!blockExist){
					console.log("called")
					this.blockMetadata.push({
						firstLineofBlock:lines[startLineOfCurrentBlock],
						timestamp:changeTime,
						lineNumber:startLineOfCurrentBlock
					})
					console.log("under called",this.blockMetadata)
				}
				console.log("startlineofcurrentblock",startLineOfCurrentBlock)
				console.log(this.blockMetadata)

				const leaf = this.app.workspace.activeLeaf;
				if(!leaf)
					return;
				const currentView = leaf.view as MarkdownView;
				const currentFile = currentView.file
				// if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
				// this.globalTimeOut = setTimeout(()=>this.updateDoc(currentFile),500)

				//set last cursor position and last line length
				//to the current value
				this.lastCursorPosition = cm.getCursor()
				this.lastLineLength=currentLength
			})
		})
	}

	onunload() {
		console.log('unloading plugin');
	}
}