pub mod ast;
pub mod compiler;
pub mod error;
pub mod lexer;
pub mod parser;
pub mod token;

use crate::error::SongWalkerError;
use crate::lexer::Lexer;
use crate::parser::Parser;
use wasm_bindgen::prelude::*;

/// Parse a `.sw` source string into a `Program` AST.
pub fn parse(input: &str) -> Result<ast::Program, SongWalkerError> {
    let tokens = Lexer::new(input).tokenize()?;
    let mut parser = Parser::new(tokens);
    Ok(parser.parse_program()?)
}

/// WASM-exposed: compile `.sw` source into a JSON event list.
#[wasm_bindgen]
pub fn compile_song(source: &str) -> Result<JsValue, JsValue> {
    let program = parse(source).map_err(|e| JsValue::from_str(&format!("{e}")))?;
    let event_list =
        compiler::compile(&program).map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&event_list).map_err(|e| JsValue::from_str(&format!("{e}")))
}
