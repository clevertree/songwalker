pub mod ast;
pub mod error;
pub mod lexer;
pub mod parser;
pub mod token;

use crate::error::SongWalkerError;
use crate::lexer::Lexer;
use crate::parser::Parser;

/// Parse a `.sw` source string into a `Program` AST.
pub fn parse(input: &str) -> Result<ast::Program, SongWalkerError> {
    let tokens = Lexer::new(input).tokenize()?;
    let mut parser = Parser::new(tokens);
    Ok(parser.parse_program()?)
}

